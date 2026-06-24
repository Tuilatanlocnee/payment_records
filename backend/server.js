const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: '150mb' })); // Tăng giới hạn tải trọng để upload file base64 lớn và ảnh minh chứng
app.use(express.urlencoded({ limit: '150mb', extended: true }));

// Kết nối MongoDB
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/payment_records';
mongoose.connect(MONGODB_URI)
  .then(() => console.log('Connected to MongoDB successfully!'))
  .catch(err => console.error('MongoDB connection error:', err));

// Định nghĩa Schema & Model Mongoose
const profileSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  createdAt: { type: Date, default: Date.now },
  status: { type: String, enum: ['new', 'completed', 'scanning'], default: 'new' },
  type: { type: String, enum: ['original', 'edited', 'mailmerge'], default: 'edited' },
  originalProfileId: { type: mongoose.Schema.Types.ObjectId, ref: 'Profile', default: null },
  mailMergeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Profile', default: null },
  variables: [{
    name: String,
    value: String,
    group: { type: String, default: 'Chung' }
  }],
  replacements: [{
    findText: String,
    replaceText: String
  }]
});

const fileSchema = new mongoose.Schema({
  profileId: { type: mongoose.Schema.Types.ObjectId, ref: 'Profile', required: true },
  name: { type: String, required: true, trim: true },
  size: { type: Number, default: 0 },
  originalContent: { type: String, required: true },
  currentContent: { type: String, required: true },
  originalBase64: { type: String, default: null }
});

const imageSchema = new mongoose.Schema({
  profileId: { type: mongoose.Schema.Types.ObjectId, ref: 'Profile', required: true },
  name: { type: String, required: true, trim: true },
  size: { type: Number, default: 0 },
  data: { type: String, required: true }, // Chuỗi base64 hình ảnh
  createdAt: { type: Date, default: Date.now }
});

const settingSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  value: mongoose.Schema.Types.Mixed
});

const Profile = mongoose.model('Profile', profileSchema);
const File = mongoose.model('File', fileSchema);
const Image = mongoose.model('Image', imageSchema);
const Setting = mongoose.model('Setting', settingSchema);


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
        
        // Tìm kích thước cx, cy của hình ảnh cụ thể rId này
        let widthPt = null;
        let heightPt = null;
        
        // Tìm w:drawing chứa rId này
        const drawingRegex = new RegExp(`<w:drawing\\b[^>]*>(?:(?!<\\/w:drawing>)[\\s\\S])*?r:embed="${rId}"[\\s\\S]*?<\\/w:drawing>`, 'i');
        const drawingMatch = paragraphContent.match(drawingRegex);
        if (drawingMatch) {
          const drawingXml = drawingMatch[0];
          const extentMatch = drawingXml.match(/<wp:extent\b[^>]*\bcx="(\d+)"\b[^>]*\bcy="(\d+)"/i);
          if (extentMatch) {
            widthPt = Math.round(parseInt(extentMatch[1]) / 12700);
            heightPt = Math.round(parseInt(extentMatch[2]) / 12700);
          }
        } else {
          // Tìm v:shape chứa rId này
          const shapeRegex = new RegExp(`<v:shape\\b[^>]*>[\\s\\S]*?r:id="${rId}"[\\s\\S]*?<\\/v:shape>`, 'i');
          const shapeMatch = paragraphContent.match(shapeRegex);
          if (shapeMatch) {
            const shapeXml = shapeMatch[0];
            const styleMatch = shapeXml.match(/style="([^"]*)"/i);
            if (styleMatch) {
              const styleStr = styleMatch[1];
              const wMatch = styleStr.match(/width:\s*([\d.]+)(pt|px|in|cm)/i);
              const hMatch = styleStr.match(/height:\s*([\d.]+)(pt|px|in|cm)/i);
              if (wMatch && hMatch) {
                widthPt = wMatch[1] + wMatch[2];
                heightPt = hMatch[1] + hMatch[2];
              }
            }
          }
        }
        
        let customStyle = "max-width: 100%; height: auto; display: block; margin: 10px auto;";
        if (widthPt && heightPt) {
          const wUnit = typeof widthPt === 'number' ? widthPt + 'pt' : widthPt;
          const hUnit = typeof heightPt === 'number' ? heightPt + 'pt' : heightPt;
          customStyle = `width: ${wUnit}; height: ${hUnit}; max-width: 100%; display: block; margin: 10px auto;`;
        }
        
        imgTags += `<img src="data:${mime};base64,${imgBase64}" style="${customStyle} border-radius: var(--radius-sm); box-shadow: var(--shadow-sm); display: inline-block;" />`;
      }
    }
  }
  
  // Trích xuất thuộc tính căn lề của paragraph từ XML
  let alignStyle = "";
  const pPrMatch = paragraphXml.match(/<w:pPr\b[^>]*>([\s\S]*?)<\/w:pPr>/);
  if (pPrMatch) {
    const jcMatch = pPrMatch[1].match(/<w:jc\b[^>]*\bw:val="([^"]+)"/);
    if (jcMatch) {
      const val = jcMatch[1];
      if (val === 'center') alignStyle = 'text-align: center;';
      else if (val === 'right') alignStyle = 'text-align: right;';
      else if (val === 'both') alignStyle = 'text-align: justify; text-justify: inter-word;';
    }
  }
  const styleAttr = alignStyle ? ` style="${alignStyle}"` : "";
  
  paragraphText += imgTags;
  const contentText = paragraphText.trim() === "" ? "<br>" : decodeXmlEntities(paragraphText).normalize('NFC');
  
  return `<div${styleAttr}>${contentText}</div>`;
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
      const cellText = cellParagraphs.join(''); // các paragraph đã là thẻ div tự xuống dòng
      cellsHtml.push(`<td>${cellText}</td>`);
    }
    rowsHtml.push(`<tr>${cellsHtml.join('')}</tr>`);
  }
  // Kiểm tra thuộc tính đường viền bảng từ XML để phân loại bảng có viền/không viền
  const hasBorders = tableXml.includes('<w:tblBorders') && !tableXml.includes('w:val="none"');
  const tableClass = hasBorders ? 'docx-table' : 'docx-table docx-table-borderless';
  
  return `<table class="${tableClass}"><tbody>${rowsHtml.join('')}</tbody></table>`;
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
    const elementRegex = /(<w:p\b[^>]*\/>|<w:p\b[^>]*>[\s\S]*?<\/w:p>|<w:tbl\b[^>]*>[\s\S]*?<\/w:tbl>)/g;
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


/**
 * ==========================================================================
 * ROUTING API (MONGODB IMPLEMENTATION)
 * ==========================================================================
 */

// Lấy danh sách hồ sơ
app.get('/api/profiles', async (req, res) => {
  try {
    const dbProfiles = await Profile.find().sort({ createdAt: -1 }).lean();
    const dbSetting = await Setting.findOne({ key: 'activeProfileId' }).lean();
    
    // Ghép files và images tương ứng vào từng profile
    const profilesWithFiles = await Promise.all(dbProfiles.map(async (p) => {
      const files = await File.find({ profileId: p._id }).lean();
      const formattedFiles = files.map(f => ({
        id: f._id.toString(),
        name: f.name,
        size: f.size,
        originalContent: f.originalContent,
        currentContent: f.currentContent,
        originalBase64: f.originalBase64
      }));

      const images = await Image.find({ profileId: p._id }).lean();
      const formattedImages = images.map(img => ({
        id: img._id.toString(),
        name: img.name,
        size: img.size,
        data: img.data,
        createdAt: img.createdAt
      }));

      // Nạp live variables từ Tệp Mail Merge kết nối nếu có
      let variables = p.variables || [];
      if (p.type === 'edited' && p.mailMergeId) {
        const mmProfile = dbProfiles.find(x => x._id.toString() === p.mailMergeId.toString());
        if (mmProfile) {
          variables = mmProfile.variables || [];
        } else {
          const mmDbProfile = await Profile.findById(p.mailMergeId).lean();
          if (mmDbProfile) {
            variables = mmDbProfile.variables || [];
          }
        }
      }

      return {
        id: p._id.toString(),
        name: p.name,
        createdAt: p.createdAt,
        status: p.status,
        type: p.type || 'edited',
        originalProfileId: p.originalProfileId ? p.originalProfileId.toString() : null,
        mailMergeId: p.mailMergeId ? p.mailMergeId.toString() : null,
        variables: variables,
        replacements: p.replacements,
        files: formattedFiles,
        images: formattedImages
      };
    }));

    res.json({
      profiles: profilesWithFiles,
      activeProfileId: dbSetting ? dbSetting.value : null
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi khi lấy danh sách hồ sơ." });
  }
});

// Thiết lập hồ sơ đang được chọn
app.post('/api/profiles/active', async (req, res) => {
  const { profileId } = req.body;
  try {
    await Setting.findOneAndUpdate(
      { key: 'activeProfileId' },
      { value: profileId },
      { upsert: true, returnDocument: 'after' }
    );
    res.json({ success: true, activeProfileId: profileId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi khi đặt hồ sơ kích hoạt." });
  }
});

// Tạo hồ sơ mới
app.post('/api/profiles', async (req, res) => {
  const { name, type, originalProfileId } = req.body;
  if (!name || name.trim() === "") {
    return res.status(400).json({ error: "Tên hồ sơ không được để trống." });
  }

  try {
    let variables = [];
    if (type === 'edited' && originalProfileId) {
      const srcProfile = await Profile.findById(originalProfileId);
      if (srcProfile) {
        variables = (srcProfile.variables || []).map(v => ({
          name: v.name,
          value: v.value,
          group: v.group || 'Chung'
        }));
      }
    }

    const newProfile = new Profile({
      name: name.trim(),
      status: "new",
      type: type || 'edited',
      originalProfileId: originalProfileId || null,
      variables: variables,
      replacements: []
    });
    const savedProfile = await newProfile.save();
    
    // Nếu là hồ sơ chỉnh sửa từ hồ sơ gốc, tiến hành sao chép các tệp tài liệu
    let clonedFilesCount = 0;
    if (type === 'edited' && originalProfileId) {
      const sourceFiles = await File.find({ profileId: originalProfileId });
      if (sourceFiles.length > 0) {
        const clonedFiles = sourceFiles.map(f => new File({
          profileId: savedProfile._id,
          name: f.name,
          size: f.size,
          originalContent: f.originalContent,
          currentContent: f.currentContent,
          originalBase64: f.originalBase64
        }));
        await File.insertMany(clonedFiles);
        clonedFilesCount = clonedFiles.length;
      }
    }

    // Đặt hồ sơ vừa tạo làm active
    await Setting.findOneAndUpdate(
      { key: 'activeProfileId' },
      { value: savedProfile._id.toString() },
      { upsert: true, returnDocument: 'after' }
    );

    const files = await File.find({ profileId: savedProfile._id }).lean();
    const formattedFiles = files.map(f => ({
      id: f._id.toString(),
      name: f.name,
      size: f.size,
      originalContent: f.originalContent,
      currentContent: f.currentContent,
      originalBase64: f.originalBase64
    }));

    res.status(201).json({
      id: savedProfile._id.toString(),
      name: savedProfile.name,
      createdAt: savedProfile.createdAt,
      status: savedProfile.status,
      type: savedProfile.type,
      originalProfileId: savedProfile.originalProfileId ? savedProfile.originalProfileId.toString() : null,
      variables: savedProfile.variables || [],
      replacements: savedProfile.replacements,
      files: formattedFiles,
      images: []
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi khi tạo hồ sơ mới." });
  }
});

// Xóa hồ sơ
app.delete('/api/profiles/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await Profile.findByIdAndDelete(id);
    await File.deleteMany({ profileId: id });
    await Image.deleteMany({ profileId: id }); // Xóa sạch các ảnh minh chứng thuộc hồ sơ
    
    // Nếu hồ sơ bị xóa đang active, reset activeProfileId
    const dbSetting = await Setting.findOne({ key: 'activeProfileId' });
    if (dbSetting && dbSetting.value === id) {
      await Setting.findOneAndUpdate(
        { key: 'activeProfileId' },
        { value: null },
        { returnDocument: 'after' }
      );
    }
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi khi xóa hồ sơ." });
  }
});

// Thêm file vào hồ sơ
app.post('/api/profiles/:id/files', async (req, res) => {
  const { id } = req.params;
  const { name, size, content } = req.body;

  if (!name) {
    return res.status(400).json({ error: "Tên file không được trống." });
  }

  try {
    const profile = await Profile.findById(id);
    if (!profile) {
      return res.status(404).json({ error: "Không tìm thấy hồ sơ thanh toán." });
    }

    let fileName = name;
    let finalContent = content || "";
    let originalBase64 = null;
    const lowercaseName = fileName.toLowerCase();
    
    // Kiểm tra định dạng file và chặn file .doc cũ
    if (lowercaseName.endsWith('.doc')) {
      return res.status(400).json({ error: "Hệ thống đã chuẩn hóa chỉ nhận file .docx. Vui lòng Save As tài liệu của bạn sang định dạng .docx trước khi tải lên." });
    }

    // Tự động giải nén và trích xuất tệp .docx thành văn bản thuần
    if (lowercaseName.endsWith('.docx') && content && content.startsWith('data:')) {
      try {
        const base64Data = content.split(';base64,').pop();
        originalBase64 = base64Data;
        const buffer = Buffer.from(base64Data, 'base64');
        finalContent = parseDocxToText(buffer);
      } catch (err) {
        console.warn("Lỗi khi parse file docx, tự động chuyển về sinh nội dung giả lập:", err);
        finalContent = generateServerSimulatedContent(fileName);
      }
    } else if (lowercaseName.endsWith('.txt') && content) {
      // Cho phép tệp văn bản thuần
      finalContent = content;
    } else if (!content) {
      // Với file rỗng, sinh dữ liệu giả lập sạch
      finalContent = generateServerSimulatedContent(fileName);
    } else {
      // Bất kỳ định dạng không hỗ trợ khác
      return res.status(400).json({ error: "Định dạng file không được hỗ trợ. Hệ thống chỉ nhận file .docx hoặc .txt." });
    }

    // Kiểm tra trùng tên file cuối cùng trong hồ sơ
    const isDuplicate = await File.findOne({ profileId: id, name: fileName });
    if (isDuplicate) {
      return res.status(400).json({ error: `File "${fileName}" đã tồn tại trong hồ sơ.` });
    }

    const newFile = new File({
      profileId: id,
      name: fileName,
      size: size || 0,
      originalContent: finalContent,
      currentContent: finalContent,
      originalBase64: originalBase64
    });

    const savedFile = await newFile.save();
    
    // Đặt trạng thái hồ sơ về "new"
    profile.status = "new";
    await profile.save();

    res.status(201).json({
      id: savedFile._id.toString(),
      name: savedFile.name,
      size: savedFile.size,
      originalContent: savedFile.originalContent,
      currentContent: savedFile.currentContent,
      originalBase64: savedFile.originalBase64
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi khi tải lên tài liệu." });
  }
});

// Sao chép toàn bộ tài liệu từ một hồ sơ gốc sang hồ sơ hiện tại
app.post('/api/profiles/:id/copy-from/:sourceId', async (req, res) => {
  const { id, sourceId } = req.params;
  try {
    const targetProfile = await Profile.findById(id);
    if (!targetProfile) {
      return res.status(404).json({ error: "Không tìm thấy hồ sơ đích." });
    }

    const sourceProfile = await Profile.findById(sourceId);
    if (!sourceProfile) {
      return res.status(404).json({ error: "Không tìm thấy hồ sơ gốc nguồn." });
    }

    // Lấy các file của hồ sơ nguồn
    const sourceFiles = await File.find({ profileId: sourceId });
    if (sourceFiles.length === 0) {
      return res.status(400).json({ error: "Hồ sơ gốc nguồn không có tài liệu nào." });
    }

    // Xoá các file hiện tại nếu có (để ghi đè/sao chép sạch sẽ)
    await File.deleteMany({ profileId: id });

    // Sao chép file sang hồ sơ đích
    const clonedFiles = sourceFiles.map(f => new File({
      profileId: targetProfile._id,
      name: f.name,
      size: f.size,
      originalContent: f.originalContent,
      currentContent: f.currentContent,
      originalBase64: f.originalBase64
    }));
    await File.insertMany(clonedFiles);

    // Nếu hồ sơ nguồn có biến, sao chép các biến sang nếu hồ sơ đích chưa có biến nào
    if ((targetProfile.variables || []).length === 0 && (sourceProfile.variables || []).length > 0) {
      targetProfile.variables = sourceProfile.variables.map(v => ({
        name: v.name,
        value: v.value,
        group: v.group || 'Chung'
      }));
    }

    // Đặt link originalProfileId để liên kết nếu cần
    targetProfile.originalProfileId = sourceId;
    targetProfile.status = "new";
    await targetProfile.save();

    // Lấy lại danh sách file đã sao chép của hồ sơ hiện tại
    const files = await File.find({ profileId: id }).lean();
    const formattedFiles = files.map(f => ({
      id: f._id.toString(),
      name: f.name,
      size: f.size,
      originalContent: f.originalContent,
      currentContent: f.currentContent,
      originalBase64: f.originalBase64
    }));

    res.json({
      success: true,
      profile: {
        id: targetProfile._id.toString(),
        name: targetProfile.name,
        type: targetProfile.type,
        originalProfileId: targetProfile.originalProfileId ? targetProfile.originalProfileId.toString() : null,
        variables: targetProfile.variables || [],
        files: formattedFiles
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi khi sao chép tài liệu từ hồ sơ gốc." });
  }
});


// Xóa file khỏi hồ sơ
app.delete('/api/profiles/:id/files/:fileId', async (req, res) => {
  const { id, fileId } = req.params;
  try {
    const profile = await Profile.findById(id);
    if (!profile) {
      return res.status(404).json({ error: "Không tìm thấy hồ sơ thanh toán." });
    }

    await File.findByIdAndDelete(fileId);

    // Cập nhật lại status của profile nếu không còn file nào
    const filesCount = await File.countDocuments({ profileId: id });
    if (filesCount === 0) {
      profile.status = "new";
      await profile.save();
    }

    const remainingFiles = await File.find({ profileId: id }).lean();
    const formattedFiles = remainingFiles.map(f => ({
      id: f._id.toString(),
      name: f.name,
      size: f.size,
      originalContent: f.originalContent,
      currentContent: f.currentContent,
      originalBase64: f.originalBase64
    }));

    res.json({ success: true, files: formattedFiles });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi khi xóa tài liệu." });
  }
});

// Cập nhật danh sách biến Mail Merge
app.put('/api/profiles/:id/variables', async (req, res) => {
  const { id } = req.params;
  const { variables, rowIndex } = req.body; // [{ name, value, group }], rowIndex hiện tại

  try {
    const profile = await Profile.findById(id);
    if (!profile) {
      return res.status(404).json({ error: "Không tìm thấy hồ sơ thanh toán." });
    }

    let targetProfile = profile;
    let targetProfileId = id;

    if (profile.type === 'edited' && profile.mailMergeId) {
      targetProfileId = profile.mailMergeId.toString();
      targetProfile = await Profile.findById(targetProfileId);
      if (!targetProfile) {
        return res.status(404).json({ error: "Không tìm thấy Tệp Mail Merge gốc kết nối." });
      }
    }

    targetProfile.variables = variables || [];
    await targetProfile.save();

    // Tìm tất cả các hồ sơ có kết nối tới Tệp Mail Merge gốc này
    const connectedProfiles = await Profile.find({
      $or: [
        { _id: targetProfileId },
        { mailMergeId: targetProfileId }
      ]
    });
    const connectedProfileIds = connectedProfiles.map(cp => cp._id);

    // Đồng bộ lại tất cả file của toàn bộ các hồ sơ này
    const files = await File.find({ profileId: { $in: connectedProfileIds } });
    const currentRowIndex = rowIndex || 1;
    for (const file of files) {
      let updatedContent = file.currentContent || "";
      for (const variable of targetProfile.variables) {
        let varDisplayVal = variable.value || "";
        if (typeof varDisplayVal === 'string' && varDisplayVal.includes('\n')) {
          const lines = varDisplayVal.split('\n');
          const rIdx = currentRowIndex - 1;
          varDisplayVal = rIdx < lines.length ? lines[rIdx].trim() : "";
        }
        const regex = new RegExp(`(<span\\b[^>]*data-variable="${variable.name}"[^>]*>)([\\s\\S]*?)(<\\/span>)`, 'g');
        updatedContent = updatedContent.replace(regex, `$1${varDisplayVal}$3`);
      }
      if (updatedContent !== file.currentContent) {
        file.currentContent = updatedContent;
        await file.save();
      }
    }

    // Lấy lại danh sách file của hồ sơ hiện tại
    const updatedFiles = await File.find({ profileId: id }).lean();
    const formattedFiles = updatedFiles.map(f => ({
      id: f._id.toString(),
      name: f.name,
      size: f.size,
      originalContent: f.originalContent,
      currentContent: f.currentContent,
      originalBase64: f.originalBase64
    }));

    res.json({
      success: true,
      variables: targetProfile.variables,
      files: formattedFiles
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi khi cập nhật danh sách biến." });
  }
});

// Cập nhật nội dung tài liệu (từ trình soạn thảo Rich Text)
app.put('/api/profiles/:id/files/:fileId', async (req, res) => {
  const { id, fileId } = req.params;
  const { htmlContent, rowIndex } = req.body;
  const currentRowIndex = rowIndex || 1;

  try {
    const profile = await Profile.findById(id);
    if (!profile) {
      return res.status(404).json({ error: "Không tìm thấy hồ sơ thanh toán." });
    }

    const currentFile = await File.findById(fileId);
    if (!currentFile) {
      return res.status(404).json({ error: "Không tìm thấy tệp tài liệu." });
    }

    // 1. Lưu nội dung của tệp hiện tại trước
    currentFile.currentContent = htmlContent || "";
    await currentFile.save();

    let targetProfile = profile;
    let targetProfileId = id;

    if (profile.type === 'edited' && profile.mailMergeId) {
      targetProfileId = profile.mailMergeId.toString();
      targetProfile = await Profile.findById(targetProfileId);
      if (!targetProfile) {
        return res.status(404).json({ error: "Không tìm thấy Tệp Mail Merge gốc kết nối." });
      }
    }

    // 2. Phân tích các thẻ mail-merge-tag trong HTML để đồng bộ ngược về targetProfile.variables
    const tagRegex = /<span[^>]*class="[^"]*mail-merge-tag[^"]*"[^>]*data-variable="([^"]+)"[^>]*>([\s\S]*?)<\/span>/g;
    let match;
    let variablesChanged = false;
    const updatedVariables = (targetProfile.variables || []).map(v => ({
      name: v.name,
      value: v.value,
      group: v.group || 'Chung'
    }));

    while ((match = tagRegex.exec(htmlContent)) !== null) {
      const varName = match[1];
      const varValue = match[2].replace(/<[^>]*>/g, '').trim(); // Bỏ các thẻ lồng nhau nếu có

      const varIndex = updatedVariables.findIndex(v => v.name === varName);
      if (varIndex !== -1) {
        let oldValue = updatedVariables[varIndex].value || "";
        if (typeof oldValue === 'string' && oldValue.includes('\n')) {
          const lines = oldValue.split('\n');
          const rIdx = currentRowIndex - 1;
          while (lines.length <= rIdx) {
            lines.push("");
          }
          lines[rIdx] = varValue;
          const newValue = lines.join('\n');
          if (updatedVariables[varIndex].value !== newValue) {
            updatedVariables[varIndex].value = newValue;
            variablesChanged = true;
          }
        } else {
          if (currentRowIndex > 1) {
            const lines = [oldValue];
            const rIdx = currentRowIndex - 1;
            while (lines.length <= rIdx) {
              lines.push("");
            }
            lines[rIdx] = varValue;
            const newValue = lines.join('\n');
            updatedVariables[varIndex].value = newValue;
            variablesChanged = true;
          } else {
            if (updatedVariables[varIndex].value !== varValue) {
              updatedVariables[varIndex].value = varValue;
              variablesChanged = true;
            }
          }
        }
      } else {
        if (currentRowIndex > 1) {
          const lines = [];
          const rIdx = currentRowIndex - 1;
          while (lines.length < rIdx) {
            lines.push("");
          }
          lines.push(varValue);
          updatedVariables.push({ name: varName, value: lines.join('\n'), group: 'Chung' });
        } else {
          updatedVariables.push({ name: varName, value: varValue, group: 'Chung' });
        }
        variablesChanged = true;
      }
    }

    // 3. Nếu có biến nào thay đổi giá trị, lưu lại targetProfile và đồng bộ giá trị đó sang tất cả các file khác của các hồ sơ kết nối
    if (variablesChanged) {
      targetProfile.variables = updatedVariables;
      await targetProfile.save();

      // Tìm tất cả các hồ sơ có kết nối tới Tệp Mail Merge gốc này
      const connectedProfiles = await Profile.find({
        $or: [
          { _id: targetProfileId },
          { mailMergeId: targetProfileId }
        ]
      });
      const connectedProfileIds = connectedProfiles.map(cp => cp._id);

      const allFiles = await File.find({ profileId: { $in: connectedProfileIds } });
      for (const file of allFiles) {
        let fileContent = file.currentContent || "";
        for (const variable of targetProfile.variables) {
          let varDisplayVal = variable.value || "";
          if (typeof varDisplayVal === 'string' && varDisplayVal.includes('\n')) {
            const lines = varDisplayVal.split('\n');
            const rIdx = currentRowIndex - 1;
            varDisplayVal = rIdx < lines.length ? lines[rIdx].trim() : "";
          }
          const regex = new RegExp(`(<span\\b[^>]*data-variable="${variable.name}"[^>]*>)([\\s\\S]*?)(<\\/span>)`, 'g');
          fileContent = fileContent.replace(regex, `$1${varDisplayVal}$3`);
        }
        if (fileContent !== file.currentContent) {
          file.currentContent = fileContent;
          await file.save();
        }
      }
    }

    const updatedFiles = await File.find({ profileId: id }).lean();
    const formattedFiles = updatedFiles.map(f => ({
      id: f._id.toString(),
      name: f.name,
      size: f.size,
      originalContent: f.originalContent,
      currentContent: f.currentContent,
      originalBase64: f.originalBase64
    }));

    res.json({
      success: true,
      variables: targetProfile.variables,
      files: formattedFiles
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi khi lưu chỉnh sửa tài liệu." });
  }
});

// Tải lên ảnh minh chứng
app.post('/api/profiles/:id/images', async (req, res) => {
  const { id } = req.params;
  const { name, size, data } = req.body;

  if (!data) {
    return res.status(400).json({ error: "Dữ liệu hình ảnh không được trống." });
  }

  try {
    const profile = await Profile.findById(id);
    if (!profile) {
      return res.status(404).json({ error: "Không tìm thấy hồ sơ thanh toán." });
    }

    const newImage = new Image({
      profileId: id,
      name: name || 'Ảnh minh chứng',
      size: size || 0,
      data: data
    });

    const savedImage = await newImage.save();

    res.status(201).json({
      id: savedImage._id.toString(),
      name: savedImage.name,
      size: savedImage.size,
      data: savedImage.data,
      createdAt: savedImage.createdAt
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi khi lưu ảnh minh chứng." });
  }
});

// Lấy danh sách ảnh minh chứng của một hồ sơ
app.get('/api/profiles/:id/images', async (req, res) => {
  const { id } = req.params;
  try {
    const images = await Image.find({ profileId: id }).sort({ createdAt: -1 }).lean();
    const formattedImages = images.map(img => ({
      id: img._id.toString(),
      name: img.name,
      size: img.size,
      data: img.data,
      createdAt: img.createdAt
    }));
    res.json(formattedImages);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi khi tải danh sách ảnh minh chứng." });
  }
});

// Xóa ảnh minh chứng
app.delete('/api/profiles/:id/images/:imageId', async (req, res) => {
  const { imageId } = req.params;
  try {
    await Image.findByIdAndDelete(imageId);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi khi xóa ảnh minh chứng." });
  }
});

// API tìm kiếm và thay thế chuỗi văn bản hàng loạt
app.post('/api/profiles/:id/replace', async (req, res) => {
  const { id } = req.params;
  const { findText, replaceText, targetFileIds } = req.body;

  if (!findText) {
    return res.status(400).json({ error: "Cụm từ cần tìm kiếm không được để trống." });
  }

  try {
    const profile = await Profile.findById(id);
    if (!profile) {
      return res.status(404).json({ error: "Không tìm thấy hồ sơ thanh toán." });
    }

    // Khởi tạo lịch sử thay thế
    if (!profile.replacements) {
      profile.replacements = [];
    }

    // Lưu vào lịch sử để highlight
    const isExist = profile.replacements.some(r => r.findText === findText && r.replaceText === replaceText);
    if (!isExist) {
      profile.replacements.push({ findText, replaceText });
    }

    // Thực hiện tìm kiếm và thay thế trong từng file được chọn
    const files = await File.find({ profileId: id });
    for (const file of files) {
      if (targetFileIds.includes(file._id.toString())) {
        const normalizedContent = (file.currentContent || '').normalize('NFC');
        const normalizedFind = findText.normalize('NFC');
        const escapedFind = normalizedFind.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        const regexPattern = escapedFind.replace(/\s+/g, '\\s+');
        const regex = new RegExp(regexPattern, 'g');
        
        file.currentContent = normalizedContent.replace(regex, replaceText);
        await file.save();
      }
    }

    profile.status = "completed"; // Cập nhật trạng thái là đã chỉnh sửa thành công
    const savedProfile = await profile.save();

    const updatedFiles = await File.find({ profileId: id }).lean();
    const formattedFiles = updatedFiles.map(f => ({
      id: f._id.toString(),
      name: f.name,
      size: f.size,
      originalContent: f.originalContent,
      currentContent: f.currentContent,
      originalBase64: f.originalBase64
    }));

    res.json({
      id: savedProfile._id.toString(),
      name: savedProfile.name,
      createdAt: savedProfile.createdAt,
      status: savedProfile.status,
      replacements: savedProfile.replacements,
      files: formattedFiles
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi khi thực hiện thay thế đồng bộ." });
  }
});

// API khôi phục tài liệu gốc và xóa lịch sử thay thế trong hồ sơ
app.post('/api/profiles/:id/reset', async (req, res) => {
  const { id } = req.params;
  try {
    const profile = await Profile.findById(id);
    if (!profile) {
      return res.status(404).json({ error: "Không tìm thấy hồ sơ thanh toán." });
    }

    // Khôi phục currentContent về originalContent cho tất cả các file
    const files = await File.find({ profileId: id });
    for (const file of files) {
      file.currentContent = file.originalContent;
      await file.save();
    }

    // Xóa sạch lịch sử thay thế
    profile.replacements = [];
    profile.status = "new";
    const savedProfile = await profile.save();

    const updatedFiles = await File.find({ profileId: id }).lean();
    const formattedFiles = updatedFiles.map(f => ({
      id: f._id.toString(),
      name: f.name,
      size: f.size,
      originalContent: f.originalContent,
      currentContent: f.currentContent,
      originalBase64: f.originalBase64
    }));

    res.json({
      id: savedProfile._id.toString(),
      name: savedProfile.name,
      createdAt: savedProfile.createdAt,
      status: savedProfile.status,
      replacements: savedProfile.replacements,
      files: formattedFiles
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi khi khôi phục tài liệu gốc." });
  }
});

// API khôi phục (hoàn tác) một cụm từ đã thay thế trong hồ sơ
app.post('/api/profiles/:id/undo-replace', async (req, res) => {
  const { id } = req.params;
  const { findText, replaceText } = req.body;

  if (!findText) {
    return res.status(400).json({ error: "Cụm từ gốc không được để trống." });
  }

  try {
    const profile = await Profile.findById(id);
    if (!profile) {
      return res.status(404).json({ error: "Không tìm thấy hồ sơ thanh toán." });
    }

    // Xóa khỏi lịch sử replacements
    if (profile.replacements) {
      profile.replacements = profile.replacements.filter(r => !(r.findText === findText && r.replaceText === replaceText));
    }

    // Khôi phục lại cụm từ gốc trong tất cả các file của hồ sơ
    const files = await File.find({ profileId: id });
    for (const file of files) {
      const normalizedContent = (file.currentContent || '').normalize('NFC');
      const normalizedReplace = replaceText.normalize('NFC');
      const cleanString = (str) => (str || '').normalize('NFC').toLowerCase().replace(/\s+/g, ' ');
      
      if (cleanString(normalizedContent).includes(cleanString(normalizedReplace))) {
        const escapedReplace = normalizedReplace.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        const regexPattern = escapedReplace.replace(/\s+/g, '\\s+');
        const regex = new RegExp(regexPattern, 'g');
        file.currentContent = normalizedContent.replace(regex, findText);
        await file.save();
      }
    }

    // Nếu không còn replacements nào, cập nhật lại status về "new"
    if (!profile.replacements || profile.replacements.length === 0) {
      profile.status = "new";
    }

    const savedProfile = await profile.save();

    const updatedFiles = await File.find({ profileId: id }).lean();
    const formattedFiles = updatedFiles.map(f => ({
      id: f._id.toString(),
      name: f.name,
      size: f.size,
      originalContent: f.originalContent,
      currentContent: f.currentContent,
      originalBase64: f.originalBase64
    }));

    res.json({
      id: savedProfile._id.toString(),
      name: savedProfile.name,
      createdAt: savedProfile.createdAt,
      status: savedProfile.status,
      replacements: savedProfile.replacements,
      files: formattedFiles
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi khi hoàn tác cụm từ." });
  }
});

// API kết nối/ngắt kết nối Hồ sơ thanh toán tới Tệp Mail Merge gốc live
app.put('/api/profiles/:id/connect-mailmerge', async (req, res) => {
  const { id } = req.params;
  const { mailMergeId } = req.body; // ID của Tệp Mail Merge gốc, hoặc null/trống nếu ngắt kết nối

  try {
    const profile = await Profile.findById(id);
    if (!profile) {
      return res.status(404).json({ error: "Không tìm thấy hồ sơ thanh toán." });
    }

    profile.mailMergeId = mailMergeId ? new mongoose.Types.ObjectId(mailMergeId) : null;
    await profile.save();

    // Khi kết nối mới, tiến hành đồng bộ ngay lập tức các biến của Tệp Mail Merge gốc sang toàn bộ tài liệu của hồ sơ này
    let currentVariables = [];
    if (mailMergeId) {
      const mmProfile = await Profile.findById(mailMergeId);
      if (mmProfile) {
        currentVariables = mmProfile.variables || [];
        const files = await File.find({ profileId: id });
        for (const file of files) {
          let updatedContent = file.currentContent || "";
          for (const variable of currentVariables) {
            const regex = new RegExp(`(<span\\b[^>]*data-variable="${variable.name}"[^>]*>)([\\s\\S]*?)(<\\/span>)`, 'g');
            updatedContent = updatedContent.replace(regex, `$1${variable.value || ""}$3`);
          }
          if (updatedContent !== file.currentContent) {
            file.currentContent = updatedContent;
            await file.save();
          }
        }
      }
    }

    const updatedFiles = await File.find({ profileId: id }).lean();
    const formattedFiles = updatedFiles.map(f => ({
      id: f._id.toString(),
      name: f.name,
      size: f.size,
      originalContent: f.originalContent,
      currentContent: f.currentContent,
      originalBase64: f.originalBase64
    }));

    res.json({
      success: true,
      mailMergeId: profile.mailMergeId ? profile.mailMergeId.toString() : null,
      variables: currentVariables,
      files: formattedFiles
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi khi kết nối Tệp Mail Merge." });
  }
});

// API xuất tệp tin nén ZIP (toàn bộ hoặc chỉ các tệp đã chỉnh sửa)
// Hàm helper để phân giải giá trị của biến theo dòng (r) đối với biến nhiều dòng hoặc biến có hậu tố _r
function getVariableValueForExport(variables, varName, r) {
  // 1. Tìm biến có hậu tố dòng trước (Ví dụ: MA_HO_SO_1)
  const targetVarName = `${varName}_${r}`;
  const suffixVar = variables.find(v => v.name === targetVarName);
  if (suffixVar) {
    return suffixVar.value || "";
  }

  // 2. Tìm biến gốc không có hậu tố (Ví dụ: MA_HO_SO)
  const baseVar = variables.find(v => v.name === varName);
  if (baseVar) {
    const val = baseVar.value || "";
    if (typeof val === 'string' && val.includes('\n')) {
      const lines = val.split('\n');
      if (r - 1 < lines.length) {
        return lines[r - 1].trim();
      }
      return ""; // Vượt quá số dòng
    }
    return val; // Chỉ có 1 giá trị tĩnh, áp dụng cho tất cả các dòng
  }

  return "";
}

// Hàm thay thế các thẻ biến Mail Merge động theo chỉ số dòng (rowNum) dành riêng cho xuất bản hàng loạt
function replaceVariablesForExport(content, variables, rowNum) {
  if (!content) return "";
  // Quét các thẻ span mail-merge-tag
  const spanRegex = /(<span\b[^>]*data-variable="([^"]+)"[^>]*>)([\s\S]*?)(<\/span>)/g;
  
  return content.replace(spanRegex, (match, pStart, varName, pContent, pEnd) => {
    const value = getVariableValueForExport(variables, varName, rowNum);
    return `${pStart}${value}${pEnd}`;
  });
}

// API xuất tệp tin nén ZIP (toàn bộ hoặc chỉ các tệp đã chỉnh sửa)
app.get('/api/profiles/:id/export', async (req, res) => {
  const { id } = req.params;
  const { mode } = req.query; // 'all', 'edited' hoặc 'custom'

  try {
    const profile = await Profile.findById(id);
    if (!profile) {
      return res.status(404).json({ error: "Không tìm thấy hồ sơ thanh toán." });
    }

    const files = await File.find({ profileId: id }).lean();
    let filesToExport = [];
    if (mode === 'edited') {
      filesToExport = files.filter(f => f.currentContent !== f.originalContent);
    } else if (mode === 'custom') {
      const selectedIds = req.query.fileIds ? req.query.fileIds.split(',') : [];
      filesToExport = files.filter(f => selectedIds.includes(f._id.toString()));
    } else {
      filesToExport = files;
    }

    if (filesToExport.length === 0) {
      return res.status(400).json({ error: "Không có tệp tin nào để xuất bản." });
    }

    const zip = new AdmZip();
    const variables = profile.variables || [];

    // 1. Kiểm tra xem có cấu trúc bảng Excel hay không (bằng cách tìm biến có hậu tố _[số] hoặc biến nhiều dòng)
    const rowSuffixRegex = /^(.*)_(\d+)$/;
    let maxSuffixRowIndex = 0;
    let maxMultiLineRows = 0;
    variables.forEach(v => {
      // Đếm theo hậu tố _r
      const match = v.name.match(rowSuffixRegex);
      if (match) {
        const rowNum = parseInt(match[2]);
        if (rowNum > maxSuffixRowIndex) {
          maxSuffixRowIndex = rowNum;
        }
      }
      // Đếm theo dòng giá trị (\n)
      if (v.value && typeof v.value === 'string' && v.value.includes('\n')) {
        const lines = v.value.split('\n').map(l => l.trim());
        if (lines.length > maxMultiLineRows) {
          maxMultiLineRows = lines.length;
        }
      }
    });

    const maxRowIndex = Math.max(maxSuffixRowIndex, maxMultiLineRows);
    const isTableMode = maxRowIndex > 0;

    if (isTableMode) {
      // A. CHẾ ĐỘ XUẤT BẢN HÀNG LOẠT (BATCH GENERATION): Nhân bản tài liệu theo dòng Excel
      // Lấy danh sách tên biến gốc không có hậu tố _[số]
      const uniqueVarNames = [...new Set(variables.map(v => {
        const match = v.name.match(rowSuffixRegex);
        return match ? match[1] : v.name;
      }))];

      for (let r = 1; r <= maxRowIndex; r++) {
        // Tìm biến định danh thư mục cho dòng r (Ưu tiên MA_HO_SO hoặc TEN_DON_VI)
        const maHoSoVal = getVariableValueForExport(variables, "MA_HO_SO", r) || getVariableValueForExport(variables, "MA_HS", r);
        const tenDonViVal = getVariableValueForExport(variables, "TEN_DON_VI", r) || getVariableValueForExport(variables, "TEN_CONG_TY", r);
        
        let folderName = "";
        if (maHoSoVal) {
          folderName = maHoSoVal.trim();
        } else if (tenDonViVal) {
          folderName = tenDonViVal.trim();
        } else {
          folderName = `Dong_${r}`;
        }
        
        // Làm sạch tên thư mục khỏi các ký tự đặc biệt không hợp lệ trên Windows/Linux
        folderName = folderName.replace(/[\/\\?%*:|"<>]/g, '-');

        for (const file of filesToExport) {
          const dotIndex = file.name.lastIndexOf('.');
          const baseName = dotIndex !== -1 ? file.name.substring(0, dotIndex) : file.name;
          const ext = dotIndex !== -1 ? file.name.substring(dotIndex) : '.txt';
          
          const extLower = ext.toLowerCase();
          let exportExt = ext;
          if (extLower === '.doc' || extLower === '.docx') {
            exportExt = '.docx';
          }
          const exportName = `${baseName}_hoanthien${exportExt}`;
          const zipFilePath = `${folderName}/${exportName}`;

          const isDocx = extLower === '.docx';
          const isDoc = extLower === '.doc';

          if ((isDocx || isDoc) && file.originalBase64) {
            // Khôi phục logic thay thế trực tiếp vào XML của file Word gốc
            try {
              const zipBuffer = Buffer.from(file.originalBase64, 'base64');
              const docxZip = new AdmZip(zipBuffer);
              let documentXml = docxZip.readAsText('word/document.xml');
              if (documentXml) {
                // Tạo replacements động cho dòng r này
                const replacementsForThisFile = [];
                
                // 1. Thêm các replacements tĩnh từ profile.replacements
                if (profile.replacements && profile.replacements.length > 0) {
                  profile.replacements.forEach(rep => {
                    replacementsForThisFile.push({
                      findText: rep.findText,
                      replaceText: rep.replaceText
                    });
                  });
                }

                // 2. Thêm các biến Mail Merge động được map theo dòng r
                uniqueVarNames.forEach(varName => {
                  const value = getVariableValueForExport(variables, varName, r);
                  
                  replacementsForThisFile.push({
                    findText: `{{${varName}}}`,
                    replaceText: value
                  });
                  replacementsForThisFile.push({
                    findText: `{{ ${varName} }}`,
                    replaceText: value
                  });
                });

                documentXml = replaceTextInDocxXml(documentXml, replacementsForThisFile);
                docxZip.updateFile('word/document.xml', Buffer.from(documentXml, 'utf-8'));
                zip.addFile(zipFilePath, docxZip.toBuffer());
              } else {
                // Fallback tạo file docx tối giản nếu không đọc được xml
                const replacedHtml = replaceVariablesForExport(file.currentContent || "", variables, r);
                const textOnly = replacedHtml.replace(/<[^>]*>/g, '');
                zip.addFile(zipFilePath, createMinimalDocx(textOnly));
              }
            } catch (err) {
              console.error(`Lỗi khi xử lý đồng bộ tệp tin Word ${file.name} dòng ${r}:`, err);
              const replacedHtml = replaceVariablesForExport(file.currentContent || "", variables, r);
              const textOnly = replacedHtml.replace(/<[^>]*>/g, '');
              zip.addFile(zipFilePath, createMinimalDocx(textOnly));
            }
          } else {
            // Tệp văn bản thuần (.txt) hoặc các tệp tin khác
            const replacedHtml = replaceVariablesForExport(file.currentContent || "", variables, r);
            const textOnly = replacedHtml
              .replace(/<br\s*\/?>/gi, '\n')
              .replace(/<\/div>/gi, '\n')
              .replace(/<\/p>/gi, '\n')
              .replace(/<[^>]*>/g, '');
            zip.addFile(zipFilePath, Buffer.from(textOnly, 'utf-8'));
          }
        }
      }
    } else {
      // B. CHẾ ĐỘ XUẤT BẢN ĐƠN LẺ THÔNG THƯỜNG (SINGLE DOCUMENT)
      for (const file of filesToExport) {
        const dotIndex = file.name.lastIndexOf('.');
        const baseName = dotIndex !== -1 ? file.name.substring(0, dotIndex) : file.name;
        const ext = dotIndex !== -1 ? file.name.substring(dotIndex) : '.txt';
        
        const extLower = ext.toLowerCase();
        let exportExt = ext;
        if (extLower === '.doc' || extLower === '.docx') {
          exportExt = '.docx';
        }
        const exportName = `${baseName}_hoanthien${exportExt}`;
        
        const isDocx = extLower === '.docx';
        const isDoc = extLower === '.doc';
        
        if ((isDocx || isDoc) && file.originalBase64) {
          // Khôi phục logic thay thế trực tiếp vào XML của file Word gốc
          try {
            const zipBuffer = Buffer.from(file.originalBase64, 'base64');
            const docxZip = new AdmZip(zipBuffer);
            let documentXml = docxZip.readAsText('word/document.xml');
            if (documentXml) {
              const replacementsForThisFile = [];
              
              // 1. Thêm các replacements tĩnh từ profile.replacements
              if (profile.replacements && profile.replacements.length > 0) {
                profile.replacements.forEach(rep => {
                  replacementsForThisFile.push({
                    findText: rep.findText,
                    replaceText: rep.replaceText
                  });
                });
              }

              // 2. Thêm các biến Mail Merge động
              variables.forEach(v => {
                replacementsForThisFile.push({
                  findText: `{{${v.name}}}`,
                  replaceText: v.value || ""
                });
                replacementsForThisFile.push({
                  findText: `{{ ${v.name} }}`,
                  replaceText: v.value || ""
                });
              });

              documentXml = replaceTextInDocxXml(documentXml, replacementsForThisFile);
              docxZip.updateFile('word/document.xml', Buffer.from(documentXml, 'utf-8'));
              zip.addFile(exportName, docxZip.toBuffer());
            } else {
              // Fallback tạo file docx tối giản nếu không đọc được xml
              const textOnly = (file.currentContent || "").replace(/<[^>]*>/g, '');
              zip.addFile(exportName, createMinimalDocx(textOnly));
            }
          } catch (err) {
            console.error(`Lỗi khi xử lý đồng bộ tệp tin Word ${file.name}:`, err);
            const textOnly = (file.currentContent || "").replace(/<[^>]*>/g, '');
            zip.addFile(exportName, createMinimalDocx(textOnly));
          }
        } else {
          // Tệp văn bản thuần (.txt) || các tệp tin khác
          const textOnly = (file.currentContent || "")
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<\/div>/gi, '\n')
            .replace(/<\/p>/gi, '\n')
            .replace(/<[^>]*>/g, '');
          zip.addFile(exportName, Buffer.from(textOnly, 'utf-8'));
        }
      }
    }

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
