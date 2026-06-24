const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb://127.0.0.1:27017/payment_records';
mongoose.connect(MONGODB_URI)
  .then(async () => {
    console.log('Connected to MongoDB');
    
    const fileSchema = new mongoose.Schema({
      profileId: mongoose.Schema.Types.ObjectId,
      name: String,
      currentContent: String
    });
    
    const File = mongoose.model('File', fileSchema);
    
    const files = await File.find({ profileId: '6a355c6c66ebb9144587c24e' });
    console.log(`Found ${files.length} files in the profile.`);
    
    files.forEach(f => {
      console.log(`\n========================================`);
      console.log(`File: ${f.name}`);
      const text = f.currentContent || "";
      // Find matches for {{something}}
      const matches = text.match(/\{\{[^}]+\}\}/g);
      if (matches) {
        // Dedup matches
        const uniqueMatches = [...new Set(matches)];
        console.log(`Placeholders (${uniqueMatches.length}):`, uniqueMatches.join(', '));
      } else {
        console.log('No placeholders found.');
      }
    });
    
    mongoose.disconnect();
  })
  .catch(err => console.error(err));
