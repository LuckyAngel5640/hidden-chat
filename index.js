const express = require('express');
const app = express();
const mongoose = require('mongoose');
const path = require('path')
const Message = require('./message');
const session = require('express-session');
const rateLimit = require('express-rate-limit');

const messageLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 2,
  message: { error: "Too many messages, please slow down." }
});

require('dotenv').config();

function requireAdmin(req, res, next) {
  if (req.session.isAdmin) {
    next();
  } else {
    res.redirect("/login");
  }
}

app.set('view engine', 'ejs');

app.set('views', path.join(__dirname, '/views'))

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('mongodb connected'))
  .catch(err => console.error('error:', err));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24
  }
}));

app.get("/", (req, res) => {
    res.render("home.ejs");
});

app.get("/admin", requireAdmin, (req, res) => {
  Message.find()
    .sort({ createdAt: -1 })
    .then((messages) => {
      res.render("admin.ejs", { messages });
    })
    .catch((err) => {
      console.error(err);
      res.status(500).send("Something went wrong");
    });
});

app.post("/messages", messageLimiter, (req, res) => {
  const text = req.body.text;

  if (!text || text.trim() === "") {
    return res.status(400).json({ error: "Message text is required" });
  }

  if (text.length > 1000) {
    return res.status(400).json({ error: "Message is too long" });
  }

  Message.create({ text: text })
    .then((newMessage) => {
      res.json({ success: true });
    })
    .catch((err) => {
      res.status(500).json({ error: "Something went wrong" });
      console.log(err);
    });
});

app.get("/login", (req, res) => {
  res.render("login.ejs");
});

app.post("/login", (req, res) => {
  const password = req.body.password;

  if (password === process.env.ADMIN_PASSWORD) {
    req.session.isAdmin = true;
    res.redirect("/admin");
  } else {
    res.redirect("/login");
  }
});

app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/login");
  });
});

app.listen(3000, () => {
  console.log('server started successfully');
});
