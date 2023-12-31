const express = require('express');
const cors = require('cors');
const mongoose = require("mongoose");
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('./models/User.js');
const Place = require('./models/Place.js');
const Booking = require('./models/Booking.js');
const cookieParser = require('cookie-parser');
const multer = require('multer');
const fs = require('fs');

require('dotenv').config();
const app = express();

const bcryptSalt = bcrypt.genSaltSync(10);
const jwtSecret = "asdfe45we45w345wegw345werjktjwertkj"

app.use(cors({
  credentials: true,
  origin: ["http://localhost:3000","https://airbnb-react-simple.vercel.app","http://localhost:3001"],
  default: "https://airbnb-react-simple.vercel.app"
}));
app.use(express.json());
app.use(cookieParser());
app.use('/uploads', express.static(__dirname + '/uploads'));

mongoose.connect(process.env.MONGO_URL);

function getUserDataFromReq(req) {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1]

  return new Promise((resolve, reject) => {
    jwt.verify(token, jwtSecret, {}, async (err, userData) => {
      if (err) throw err;
      resolve(userData);
    });
  });
}

app.post('/api/register', async (req, res) => {
  const { name, email, password } = req.body;

  try {
    const userDoc = await User.create({
      name,
      email,
      password: bcrypt.hashSync(password, bcryptSalt),
    });
    res.json(userDoc);
  } catch (e) {
    res.status(422).json(e);
  }

});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  const userDoc = await User.findOne({ email });
  if (userDoc) {
    const passOk = bcrypt.compareSync(password, userDoc.password);
    if (passOk) {
      jwt.sign({
        email: userDoc.email,
        id: userDoc._id
      }, jwtSecret, {}, (err, token) => {
        if (err) throw err;
        res.cookie('token', token).json({
          email: userDoc.email,
          name: userDoc.name,
          id: userDoc._id,
          token
        });
      });
    } else {
      res.status(422).json('pass not ok');
    }
  } else {
    res.status(401).json({ok: false});
  }
});

app.get('/api/login', async (req, res) => {
  const { email, password } = req.body;
  const userDoc = await User.findOne({ email });
  if (userDoc) {
    const passOk = bcrypt.compareSync(password, userDoc.password);
    if (passOk) {
      jwt.sign({
        email: userDoc.email,
        id: userDoc._id
      }, jwtSecret, {}, (err, token) => {
        if (err) throw err;
        res.cookie('token', token).json({
          email: userDoc.email,
          name: userDoc.name,
          id: userDoc._id,
          token
        });
      });
    } else {
      res.status(422).json('pass not ok');
    }
  } else {
    res.status(401).json({ok: false});
  }
});

app.get('/api/profile', (req, res) => {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1]

  if (token) {
    jwt.verify(token, jwtSecret, {}, async (err, userData) => {
      if (err) throw err;
      const { name, email, _id } = await User.findById(userData.id);
      res.json({ name, email, _id });
    });
  } else {
    res.status(401).json(null);
  }
});

app.post('/api/logout', (req, res) => {
  res.cookie('token', '').json(true);
});


app.post('/api/upload-by-link', async (req, res) => {
  const { link, vps } = req.body;
  if(vps) return res.json(link);
  const request = require('request').defaults({ encoding: null });
  request.get(link, function (error, response, body) {
    if (!error && response.statusCode == 200) {
        const data = "data:" + response.headers["content-type"] + ";base64," + Buffer.from(body).toString('base64');
        res.json(data);
    }
  });
});

const photosMiddleware = multer({ dest: 'uploads/' });
app.post('/api/upload', photosMiddleware.array('photos', 100), (req, res) => {
  const uploadedFiles = [];
  for (let i = 0; i < req.files.length; i++) {
    const { path, originalname } = req.files[i];
    const parts = originalname.split('.');
    const ext = parts[parts.length - 1];
    const newPath = path + '.' + ext;
    fs.renameSync(path, newPath);
    uploadedFiles.push(newPath.replace('uploads/', ''));
  }
  res.json(uploadedFiles);
});

app.post('/api/places', (req, res) => {
  const authHeader = req.headers['authorization']
  console.log({authHeader})
  const token = authHeader && authHeader.split(' ')[1]

  const {
    title, address, addedPhotos, description, price,
    perks, extraInfo, checkIn, checkOut, maxGuests,
  } = req.body;
  console.log({title, address, addedPhotos, description, price,
    perks, extraInfo, checkIn, checkOut, maxGuests,})

  jwt.verify(token, jwtSecret, {}, async (err, userData) => {
    if (err) {
      console.log(err);
      res.status(500);
      return;
    }
    const placeDoc = await Place.create({
      owner: userData.id, price,
      title, address, photos: addedPhotos, description,
      perks, extraInfo, checkIn, checkOut, maxGuests,
    });
    console.log({placeDoc})
    res.status(200).json(placeDoc);
    return;
  });
});

app.get('/api/user-places', (req, res) => {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1]

  jwt.verify(token, jwtSecret, {}, async (err, userData) => {
    console.log({ err, userData })
    const { id } = userData;
    res.json(await Place.find({ owner: id }));
  });
});

app.get('/api/places/:id', async (req, res) => {
  const { id } = req.params;
  res.json(await Place.findById(id));
});

app.put('/api/places', async (req, res) => {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1]

  const {
    id, title, address, addedPhotos, description,
    perks, extraInfo, checkIn, checkOut, maxGuests, price,
  } = req.body;
  jwt.verify(token, jwtSecret, {}, async (err, userData) => {
    if (err) throw err;
    const placeDoc = await Place.findById(id);
    if (userData.id === placeDoc.owner.toString()) {
      placeDoc.set({
        title, address, photos: addedPhotos, description,
        perks, extraInfo, checkIn, checkOut, maxGuests, price,
      });
      await placeDoc.save();
      res.json('ok');
    }
  });
});

app.get('/api/places', async (req, res) => {
  res.json(await Place.find());
});

app.post('/api/bookings', async (req, res) => {
  const userData = await getUserDataFromReq(req);
  const {
    place, checkIn, checkOut, numberOfGuests, name, phone, price,
  } = req.body;
  Booking.create({
    place, checkIn, checkOut, numberOfGuests, name, phone, price,
    user: userData.id,
  }).then((doc) => {
    res.json(doc);
  }).catch((err) => {
    throw err;
  });
});

app.get('/api/bookings', async (req, res) => {
  const userData = await getUserDataFromReq(req);
  res.json(await Booking.find({ user: userData.id }).populate('place'));
});

app.listen(4000);