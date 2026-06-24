const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb://127.0.0.1:27017/payment_records';
mongoose.connect(MONGODB_URI)
  .then(async () => {
    console.log('Connected to MongoDB');
    
    const profileSchema = new mongoose.Schema({
      name: String,
      type: String,
      variables: Array
    });
    
    const fileSchema = new mongoose.Schema({
      profileId: mongoose.Schema.Types.ObjectId,
      name: String
    });
    
    const Profile = mongoose.model('Profile', profileSchema);
    const File = mongoose.model('File', fileSchema);
    
    const profiles = await Profile.find();
    console.log('--- PROFILES ---');
    for (const p of profiles) {
      console.log(`Profile: ID=${p._id}, Name=${p.name}, Type=${p.type}`);
      const files = await File.find({ profileId: p._id });
      console.log(`Files count: ${files.length}`);
      files.forEach(f => console.log(`  File: ${f.name}`));
    }
    
    mongoose.disconnect();
  })
  .catch(err => console.error(err));
