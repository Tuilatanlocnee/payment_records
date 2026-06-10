const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;
const DB_FILE = path.join(__dirname, 'db.json');

app.use(cors());
app.use(express.json({ limit: '50mb' })); // Tăng giới hạn tải trọng để upload file base64 lớn


// Giải mã thực thể XML cơ bản
function decodeXmlEntities(str) {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

// Mã hóa các ký tự đặc biệt cho XML
function escapeXml(unsafe) {
  if (!unsafe) return "";
  return unsafe.replace(/[<>&'"]/g, function (c) {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
    }
  });
}

// Thay thế văn bản cấp độ paragraph XML của Word bằng cách chỉ chỉnh sửa nội dung thẻ <w:t>
function replaceInParagraphs(xml, findText, replaceText) {
  const paragraphRegex = /(<w:p\b[^>]*>)([\s\S]*?)(<\/w:p>)/g;
  
  return xml.replace(paragraphRegex, (match, pStart, pContent, pEnd) => {
    // 1. Tìm tất cả các thẻ <w:t> trong đoạn văn này
    const tTagRegex = /(<w:t\b[^>]*>)([\s\S]*?)(<\/w:t>)/g;
    let tTags = [];
    let tMatch;
    while ((tMatch = tTagRegex.exec(pContent)) !== null) {
      tTags.push({
        fullTag: tMatch[0],
        startTag: tMatch[1],
        content: tMatch[2],
        endTag: tMatch[3],
        index: tMatch.index,
        length: tMatch[0].length
      });
    }
    
    if (tTags.length === 0) {
      return match;
    }
    
    // 2. Tái cấu trúc văn bản thuần và lập chỉ mục offsets
    let decodedTexts = tTags.map(tag => decodeXmlEntities(tag.content).normalize('NFC'));
    let fullParagraphText = decodedTexts.join('');
    
    let currentOffset = 0;
    tTags.forEach((tag, idx) => {
      tag.textStart = currentOffset;
      tag.textEnd = currentOffset + decodedTexts[idx].length;
      tag.decodedText = decodedTexts[idx];
      currentOffset = tag.textEnd;
    });
    
    // 3. Tìm tất cả vị trí khớp của cụm từ cần tìm
    const escapedFind = findText.normalize('NFC').replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regexPattern = escapedFind.replace(/\s+/g, '\\s+');
    const regex = new RegExp(regexPattern, 'g');
    
    let matchRanges = [];
    let regexMatch;
    while ((regexMatch = regex.exec(fullParagraphText)) !== null) {
      matchRanges.push({
        start: regexMatch.index,
        end: regexMatch.index + regexMatch[0].length
      });
    }
    
    if (matchRanges.length === 0) {
      return match;
    }
    
    // Sắp xếp các khoảng khớp từ phải qua trái (giảm dần) để tránh lệch chỉ mục
    matchRanges.sort((a, b) => b.start - a.start);
    
    // 4. Áp dụng thay thế lên từng khoảng khớp
    for (const range of matchRanges) {
      const { start, end } = range;
      const overlappingTags = tTags.filter(tag => tag.textStart < end && tag.textEnd > start);
      
      if (overlappingTags.length === 0) continue;
      
      const firstTag = overlappingTags[0];
      const beforeText = firstTag.decodedText.substring(0, Math.max(0, start - firstTag.textStart));
      const afterText = firstTag.textEnd >= end ? firstTag.decodedText.substring(end - firstTag.textStart) : "";
      
      firstTag.decodedText = beforeText + replaceText + afterText;
      
      for (let i = 1; i < overlappingTags.length; i++) {
        const tag = overlappingTags[i];
        if (i === overlappingTags.length - 1 && tag.textEnd >= end) {
          tag.decodedText = tag.decodedText.substring(end - tag.textStart);
        } else {
          tag.decodedText = "";
        }
      }
      
      // Cập nhật lại offsets của các tag sau khi thay đổi độ dài text
      let offset = 0;
      for (const tag of tTags) {
        tag.textStart = offset;
        tag.textEnd = offset + tag.decodedText.length;
        offset = tag.textEnd;
      }
    }
    
    // 5. Dựng lại pContent mới từ danh sách tTags đã chỉnh sửa
    let newPContent = "";
    let lastIdx = 0;
    for (const tag of tTags) {
      newPContent += pContent.substring(lastIdx, tag.index);
      newPContent += tag.startTag + escapeXml(tag.decodedText) + tag.endTag;
      lastIdx = tag.index + tag.length;
    }
    newPContent += pContent.substring(lastIdx);
    
    return `${pStart}${newPContent}${pEnd}`;
  });
}

// Hàm chính xử lý tìm kiếm và thay thế trong XML của tệp Word (.docx)
function replaceTextInDocxXml(documentXml, replacements) {
  let updatedXml = documentXml;
  
  for (const rep of replacements) {
    if (!rep.findText) continue;
    const findText = rep.findText.normalize('NFC');
    const replaceText = (rep.replaceText || "").normalize('NFC');
    
    const xmlFind = escapeXml(findText);
    const xmlReplace = escapeXml(replaceText);
    
    // Nếu cụm từ khớp trực tiếp (không bị ngắt dòng hay tag chen ngang), thay thế nhanh
    if (updatedXml.includes(xmlFind)) {
      const escapedFind = xmlFind.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      const regex = new RegExp(escapedFind, 'g');
      updatedXml = updatedXml.replace(regex, xmlReplace);
    } else {
      // Trường hợp bị Word tự động phân tách tag, dùng giải pháp thay thế ở cấp độ paragraph
      updatedXml = replaceInParagraphs(updatedXml, findText, replaceText);
    }
  }
  
  return updatedXml;
}

// Sinh cấu trúc tệp Word (.docx) tối giản hợp lệ chứa văn bản thuần (dùng khi tệp Word cũ thiếu dữ liệu Base64)
function createMinimalDocx(text) {
  try {
    const zip = new AdmZip();
    
    // 1. _rels/.rels
    const relsContent = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;
    zip.addFile('_rels/.rels', Buffer.from(relsContent, 'utf-8'));
    
    // 2. [Content_Types].xml
    const contentTypesContent = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;
    zip.addFile('[Content_Types].xml', Buffer.from(contentTypesContent, 'utf-8'));
    
    // 3. word/document.xml
    const paragraphs = (text || "").split('\n').map(line => {
      const escapedLine = escapeXml(line.trim());
      return `<w:p><w:r><w:t>${escapedLine}</w:t></w:r></w:p>`;
    }).join('');
    
    const documentXmlContent = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${paragraphs}
    <w:sectPr/>
  </w:body>
</w:document>`;
    zip.addFile('word/document.xml', Buffer.from(documentXmlContent, 'utf-8'));
    
    return zip.toBuffer();
  } catch (err) {
    console.error("Lỗi khi sinh tệp Word tối giản:", err);
    return Buffer.from(text || "", 'utf-8');
  }
}



// Hàm phân tích một đoạn văn <w:p> từ cấu trúc XML Word
function parseParagraph(paragraphXml, relsMap, zip) {
  const paragraphRegex = /<w:p\b[^>]*>([\s\S]*?)<\/w:p>/;
  const match = paragraphXml.match(paragraphRegex);
  if (!match) return "";
  const paragraphContent = match[1];
  let paragraphText = "";
  
  let runMatch;
  const localRunRegex = /<w:r\b[^>]*>([\s\S]*?)<\/w:r>/g;
  
  while ((runMatch = localRunRegex.exec(paragraphContent)) !== null) {
    const runXml = runMatch[1];
    
    // Trích xuất text và ngắt dòng trong run
    const cleanRunXml = runXml
      .replace(/<w:br\b[^>]*\/>/g, '\n')
      .replace(/<w:cr\b[^>]*\/>/g, '\n')
      .replace(/<w:tab\b[^>]*\/>/g, '\t');

    let textMatch;
    const textRegex = /<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g;
    while ((textMatch = textRegex.exec(cleanRunXml)) !== null) {
      paragraphText += textMatch[1];
    }
  }
  
  // Trích xuất hình ảnh dựa trên các relationship ID có trong paragraph
  let imgTags = "";
  const attrRegex = /=\s*["']([^"']+)["']/g;
  let attrMatch;
  const seenRids = new Set();
  while ((attrMatch = attrRegex.exec(paragraphContent)) !== null) {
    const rId = attrMatch[1];
    if (relsMap[rId] && !seenRids.has(rId)) {
      seenRids.add(rId);
      const target = relsMap[rId];
      let zipPath = target;
      if (!zipPath.startsWith('word/')) {
        zipPath = 'word/' + zipPath;
      }
      const entry = zip.getEntry(zipPath);
      if (entry) {
        const imgBuffer = entry.getData();
        const ext = zipPath.split('.').pop().toLowerCase();
        let mime = 'image/png';
        if (ext === 'jpg' || ext === 'jpeg') mime = 'image/jpeg';
        else if (ext === 'gif') mime = 'image/gif';
        else if (ext === 'svg') mime = 'image/svg+xml';
        const imgBase64 = imgBuffer.toString('base64');
        imgTags += `\n[IMAGE:data:${mime};base64,${imgBase64}]\n`;
      }
    }
  }
  paragraphText += imgTags;
  return decodeXmlEntities(paragraphText).normalize('NFC');
}

// Hàm phân tích một bảng biểu <w:tbl> từ cấu trúc XML Word
function parseTable(tableXml, relsMap, zip) {
  let rowsHtml = [];
  const rowRegex = /<w:tr\b[^>]*>([\s\S]*?)<\/w:tr>/g;
  let rowMatch;
  while ((rowMatch = rowRegex.exec(tableXml)) !== null) {
    const rowContent = rowMatch[1];
    let cellsHtml = [];
    const cellRegex = /<w:tc\b[^>]*>([\s\S]*?)<\/w:tc>/g;
    let cellMatch;
    while ((cellMatch = cellRegex.exec(rowContent)) !== null) {
      const cellContent = cellMatch[1];
      // Phân tích các đoạn văn trong cell
      const pRegex = /<w:p\b[^>]*>([\s\S]*?)<\/w:p>/g;
      let pMatch;
      let cellParagraphs = [];
      while ((pMatch = pRegex.exec(cellContent)) !== null) {
        cellParagraphs.push(parseParagraph(pMatch[0], relsMap, zip));
      }
      const cellText = cellParagraphs.join('<br>');
      cellsHtml.push(`<td>${cellText}</td>`);
    }
    rowsHtml.push(`<tr>${cellsHtml.join('')}</tr>`);
  }
  return `<table class="docx-table"><tbody>${rowsHtml.join('')}</tbody></table>`;
}

// Phân tích file .docx để trích xuất văn bản thô sạch sẽ, bảo toàn cấu trúc bảng và ảnh
function parseDocxToText(buffer) {
  try {
    const zip = new AdmZip(buffer);
    const documentXml = zip.readAsText('word/document.xml');
    if (!documentXml) {
      throw new Error("Không thể tìm thấy word/document.xml trong tệp .docx");
    }

    // Đọc các relationships hình ảnh từ file document.rels để lấy mapping rId -> target
    let relsMap = {};
    try {
      const relsXml = zip.readAsText('word/_rels/document.xml.rels');
      if (relsXml) {
        const relRegex = /<Relationship\b[^>]*Id="([^"]+)"[^>]*Type="[^"]*\/relationships\/image"[^>]*Target="([^"]+)"/g;
        let relMatch;
        while ((relMatch = relRegex.exec(relsXml)) !== null) {
          relsMap[relMatch[1]] = relMatch[2];
        }
      }
    } catch (e) {
      console.warn("Không tìm thấy tệp relationships hình ảnh:", e.message);
    }

    const bodyRegex = /<w:body\b[^>]*>([\s\S]*?)<\/w:body>/;
    const bodyMatch = documentXml.match(bodyRegex);
    if (!bodyMatch) {
      throw new Error("Không thể tìm thấy w:body trong tệp .docx");
    }
    const bodyContent = bodyMatch[1];

    // Lấy tất cả các phần tử con cấp cao nhất của w:body (w:p hoặc w:tbl)
    const elementRegex = /(<w:p\b[^>]*>[\s\S]*?<\/w:p>|<w:tbl\b[^>]*>[\s\S]*?<\/w:tbl>)/g;
    let elementMatch;
    let elements = [];

    while ((elementMatch = elementRegex.exec(bodyContent)) !== null) {
      const elementXml = elementMatch[1];
      if (elementXml.startsWith('<w:p')) {
        elements.push(parseParagraph(elementXml, relsMap, zip));
      } else if (elementXml.startsWith('<w:tbl')) {
        elements.push(parseTable(elementXml, relsMap, zip));
      }
    }
    
    return elements.join('\n');
  } catch (error) {
    console.error("Lỗi khi phân tích tệp .docx:", error);
    throw error;
  }
}

// Sinh nội dung giả lập cho các tệp .doc cũ hoặc tệp lỗi
function generateServerSimulatedContent(filename) {
  return `TÀI LIỆU CHỨNG TỪ THANH TOÁN (GIẢ LẬP)
Tên tài liệu gốc: ${filename}
---
Đơn vị đề nghị thanh toán: Công ty Cổ phần Công nghệ thông tin Phương Nam
Mã số thuế: 0100686209-009
Địa chỉ Bên thụ hưởng: 123/45 Đường Trần Hưng Đạo, Quận Ninh Kiều, TP. Cần Thơ
Tài khoản thụ hưởng: 0111000234xxx tại Ngân hàng TMCP Ngoại thương Việt Nam - CN Cần Thơ (Vietcombank)
Số tiền quyết toán: 120.000.000 VNĐ

Nội dung thanh toán: Chi phí thực hiện dịch vụ bảo trì kỹ thuật và hạ tầng viễn thông cho MobiFone Cần Thơ quý I năm 2026.
Kính mong Ban Giám đốc MobiFone phê duyệt quyết toán.`;
}

// Đọc và lưu cơ sở dữ liệu db.json
function readDatabase() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      const initialData = {
        profiles: [],
        activeProfileId: null
      };
      fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2), 'utf-8');
      return initialData;
    }
    const rawData = fs.readFileSync(DB_FILE, 'utf-8');
    return JSON.parse(rawData);
  } catch (error) {
    console.error("Lỗi khi đọc file database:", error);
    return { profiles: [], activeProfileId: null };
  }
}

function writeDatabase(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.error("Lỗi khi ghi file database:", error);
  }
}

/**
 * ==========================================================================
 * ROUTING API
 * ==========================================================================
 */

// Lấy danh sách hồ sơ
app.get('/api/profiles', (req, res) => {
  const db = readDatabase();
  res.json({
    profiles: db.profiles,
    activeProfileId: db.activeProfileId
  });
});

// Thiết lập hồ sơ đang được chọn
app.post('/api/profiles/active', (req, res) => {
  const { profileId } = req.body;
  const db = readDatabase();
  db.activeProfileId = profileId;
  writeDatabase(db);
  res.json({ success: true, activeProfileId: db.activeProfileId });
});

// Tạo hồ sơ mới
app.post('/api/profiles', (req, res) => {
  const { name } = req.body;
  if (!name || name.trim() === "") {
    return res.status(400).json({ error: "Tên hồ sơ không được để trống." });
  }

  const db = readDatabase();
  const newProfile = {
    id: "profile-" + Date.now(),
    name: name.trim(),
    createdAt: new Date().toISOString(),
    status: "new",
    replacements: [],
    files: []
  };

  db.profiles.unshift(newProfile);
  db.activeProfileId = newProfile.id;
  writeDatabase(db);
  res.status(201).json(newProfile);
});

// Xóa hồ sơ
app.delete('/api/profiles/:id', (req, res) => {
  const { id } = req.params;
  const db = readDatabase();
  db.profiles = db.profiles.filter(p => p.id !== id);
  if (db.activeProfileId === id) {
    db.activeProfileId = null;
  }
  writeDatabase(db);
  res.json({ success: true });
});

// Thêm file vào hồ sơ
app.post('/api/profiles/:id/files', (req, res) => {
  const { id } = req.params;
  const { name, size, content } = req.body;

  if (!name) {
    return res.status(400).json({ error: "Tên file không được trống." });
  }

  const db = readDatabase();
  const profile = db.profiles.find(p => p.id === id);
  if (!profile) {
    return res.status(404).json({ error: "Không tìm thấy hồ sơ thanh toán." });
  }

  const isDuplicate = profile.files.some(f => f.name === name);
  if (isDuplicate) {
    return res.status(400).json({ error: `File "${name}" đã tồn tại trong hồ sơ.` });
  }

  let finalContent = content || "";
  let originalBase64 = null;
  
  // Tự động giải nén và trích xuất tệp .docx thành văn bản thuần
  if (name.endsWith('.docx') && content && content.startsWith('data:')) {
    try {
      const base64Data = content.split(';base64,').pop();
      originalBase64 = base64Data;
      const buffer = Buffer.from(base64Data, 'base64');
      finalContent = parseDocxToText(buffer);
    } catch (err) {
      console.warn("Lỗi khi parse file docx, tự động chuyển về sinh nội dung giả lập:", err);
      finalContent = generateServerSimulatedContent(name);
    }
  } else if ((name.endsWith('.doc') || !content) && content && content.startsWith('data:')) {
    // Với file .doc cũ hoặc file rỗng, sinh dữ liệu giả lập sạch
    finalContent = generateServerSimulatedContent(name);
  }

  const newFile = {
    id: "file-" + Date.now() + "-" + Math.random().toString(36).substr(2, 9),
    name,
    size: size || 0,
    originalContent: finalContent,
    currentContent: finalContent,
    originalBase64: originalBase64
  };

  profile.files.push(newFile);
  profile.status = "new"; // Đặt lại trạng thái chưa chỉnh sửa
  writeDatabase(db);

  res.status(201).json(newFile);
});


// Xóa file khỏi hồ sơ
app.delete('/api/profiles/:id/files/:fileId', (req, res) => {
  const { id, fileId } = req.params;
  const db = readDatabase();
  const profile = db.profiles.find(p => p.id === id);
  if (!profile) {
    return res.status(404).json({ error: "Không tìm thấy hồ sơ thanh toán." });
  }

  profile.files = profile.files.filter(f => f.id !== fileId);
  if (profile.files.length === 0) {
    profile.status = "new";
  }
  writeDatabase(db);
  res.json({ success: true, files: profile.files });
});

// Endpoint quét (chỉ giữ lại để tương thích ngược nếu frontend gọi)
app.post('/api/profiles/:id/scan', (req, res) => {
  const { id } = req.params;
  const db = readDatabase();
  const profile = db.profiles.find(p => p.id === id);
  if (!profile) {
    return res.status(404).json({ error: "Không tìm thấy hồ sơ thanh toán." });
  }
  profile.status = "scanned";
  writeDatabase(db);
  res.json(profile);
});

// API tìm kiếm và thay thế chuỗi văn bản hàng loạt
app.post('/api/profiles/:id/replace', (req, res) => {
  const { id } = req.params;
  const { findText, replaceText, targetFileIds } = req.body;

  if (!findText) {
    return res.status(400).json({ error: "Cụm từ cần tìm kiếm không được để trống." });
  }

  const db = readDatabase();
  const profile = db.profiles.find(p => p.id === id);
  if (!profile) {
    return res.status(404).json({ error: "Không tìm thấy hồ sơ thanh toán." });
  }

  // Khởi tạo lịch sử thay thế
  if (!profile.replacements) {
    profile.replacements = [];
  }

  // Lưu vào lịch sử để highlight trong preview
  const isExist = profile.replacements.some(r => r.findText === findText && r.replaceText === replaceText);
  if (!isExist) {
    profile.replacements.push({ findText, replaceText });
  }

  // Thực hiện tìm kiếm và thay thế trong từng file được chọn
  profile.files.forEach(file => {
    if (targetFileIds.includes(file.id)) {
      // Normalize NFC để đảm bảo ký tự tiếng Việt nhất quán trước khi so sánh
      const normalizedContent = (file.currentContent || '').normalize('NFC');
      const normalizedFind = findText.normalize('NFC');
      const escapedFind = normalizedFind.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      // Cho phép khớp linh hoạt bất kỳ khoảng trắng nào (kép, xuống dòng) khi thay thế
      const regexPattern = escapedFind.replace(/\s+/g, '\\s+');
      // Sử dụng flag 'g' để phân biệt chữ hoa và chữ thường theo yêu cầu của người dùng
      const regex = new RegExp(regexPattern, 'g');
      file.currentContent = normalizedContent.replace(regex, replaceText);
    }
  });

  profile.status = "completed"; // Cập nhật trạng thái là đã chỉnh sửa thành công
  writeDatabase(db);

  res.json(profile);
});

// API khôi phục tài liệu gốc và xóa lịch sử thay thế trong hồ sơ
app.post('/api/profiles/:id/reset', (req, res) => {
  const { id } = req.params;
  const db = readDatabase();
  const profile = db.profiles.find(p => p.id === id);
  if (!profile) {
    return res.status(404).json({ error: "Không tìm thấy hồ sơ thanh toán." });
  }

  // Khôi phục currentContent về originalContent cho tất cả các file
  profile.files.forEach(file => {
    file.currentContent = file.originalContent;
  });

  // Xóa sạch lịch sử thay thế
  profile.replacements = [];
  profile.status = "new";
  
  writeDatabase(db);
  res.json(profile);
});

// API khôi phục (hoàn tác) một cụm từ đã thay thế trong hồ sơ
app.post('/api/profiles/:id/undo-replace', (req, res) => {
  const { id } = req.params;
  const { findText, replaceText } = req.body;

  if (!findText) {
    return res.status(400).json({ error: "Cụm từ gốc không được để trống." });
  }

  const db = readDatabase();
  const profile = db.profiles.find(p => p.id === id);
  if (!profile) {
    return res.status(404).json({ error: "Không tìm thấy hồ sơ thanh toán." });
  }

  // Xóa khỏi lịch sử replacements
  if (profile.replacements) {
    profile.replacements = profile.replacements.filter(r => !(r.findText === findText && r.replaceText === replaceText));
  }

  // Khôi phục lại cụm từ gốc trong tất cả các file của hồ sơ
  profile.files.forEach(file => {
    const normalizedContent = (file.currentContent || '').normalize('NFC');
    const normalizedReplace = replaceText.normalize('NFC');
    const cleanString = (str) => (str || '').normalize('NFC').toLowerCase().replace(/\s+/g, ' ');
    if (cleanString(normalizedContent).includes(cleanString(normalizedReplace))) {
      const escapedReplace = normalizedReplace.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      const regexPattern = escapedReplace.replace(/\s+/g, '\\s+');
      // Đổi về 'g' để phân biệt chữ hoa và chữ thường khi hoàn tác
      const regex = new RegExp(regexPattern, 'g');
      file.currentContent = normalizedContent.replace(regex, findText);
    }
  });

  // Nếu không còn replacements nào, cập nhật lại status về "new"
  if (!profile.replacements || profile.replacements.length === 0) {
    profile.status = "new";
  }

  writeDatabase(db);
  res.json(profile);
});

// API xuất tệp tin nén ZIP (toàn bộ hoặc chỉ các tệp đã chỉnh sửa)
app.get('/api/profiles/:id/export', (req, res) => {
  const { id } = req.params;
  const { mode } = req.query; // 'all' hoặc 'edited'

  const db = readDatabase();
  const profile = db.profiles.find(p => p.id === id);
  if (!profile) {
    return res.status(404).json({ error: "Không tìm thấy hồ sơ thanh toán." });
  }

  let filesToExport = [];
  if (mode === 'edited') {
    filesToExport = profile.files.filter(f => f.currentContent !== f.originalContent);
  } else if (mode === 'custom') {
    const selectedIds = req.query.fileIds ? req.query.fileIds.split(',') : [];
    filesToExport = profile.files.filter(f => selectedIds.includes(f.id));
  } else {
    filesToExport = profile.files;
  }

  if (filesToExport.length === 0) {
    return res.status(400).json({ error: "Không có tệp tin nào để xuất bản." });
  }

  try {
    const zip = new AdmZip();
    filesToExport.forEach(file => {
      const dotIndex = file.name.lastIndexOf('.');
      const baseName = dotIndex !== -1 ? file.name.substring(0, dotIndex) : file.name;
      const ext = dotIndex !== -1 ? file.name.substring(dotIndex) : '.txt';
      const exportName = `${baseName}_hoanthien${ext}`;
      
      const isDocx = ext.toLowerCase() === '.docx';
      const isDoc = ext.toLowerCase() === '.doc';
      
      if (isDocx && file.originalBase64) {
        // Có dữ liệu Word gốc (.docx), thực hiện thay thế XML trực tiếp
        try {
          const zipBuffer = Buffer.from(file.originalBase64, 'base64');
          const docxZip = new AdmZip(zipBuffer);
          let documentXml = docxZip.readAsText('word/document.xml');
          if (documentXml) {
            documentXml = replaceTextInDocxXml(documentXml, profile.replacements || []);
            docxZip.updateFile('word/document.xml', Buffer.from(documentXml, 'utf-8'));
            zip.addFile(exportName, docxZip.toBuffer());
          } else {
            // Fallback tạo file docx tối giản nếu không đọc được xml
            zip.addFile(exportName, createMinimalDocx(file.currentContent));
          }
        } catch (err) {
          console.error(`Lỗi khi xử lý đồng bộ tệp tin Word ${file.name}:`, err);
          zip.addFile(exportName, createMinimalDocx(file.currentContent));
        }
      } else if (isDocx || isDoc) {
        // Tệp Word cũ hoặc giả lập thiếu Base64 gốc, sinh tệp Word (.docx) tối giản hợp lệ từ text thuần để đảm bảo mở được bình thường
        zip.addFile(exportName, createMinimalDocx(file.currentContent));
      } else {
        // Tệp văn bản thuần (.txt) hoặc các tệp tin khác
        zip.addFile(exportName, Buffer.from(file.currentContent, 'utf-8'));
      }
    });

    const zipBuffer = zip.toBuffer();
    
    // Thiết lập headers gửi file ZIP
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(profile.name)}_export.zip"`);
    res.send(zipBuffer);
  } catch (err) {
    console.error("Lỗi khi tạo file nén ZIP:", err);
    res.status(500).json({ error: "Không thể tạo tệp nén ZIP." });
  }
});

// Khởi chạy server
app.listen(PORT, () => {
  console.log(`Backend API Server is running on port ${PORT}`);
});
