var express = require("express");
var router = express.Router();
const bcrypt = require("bcrypt");
const saltRounds = 10;
const path = require("path");
const fs = require("fs");
const { isLoggedIn } = require("../helpers/util");

module.exports = (db) => {
  router.get("/", function (req, res) {
    res.render("login", {
      failedInfo: req.flash("failedInfo"),
      successInfo: req.flash("successInfo")
    });
  });

  router.post("/", async (req, res) => {
    try {
      const { email, password } = req.body;
      const { rows: users } = await db.query(
        "SELECT * FROM users WHERE email = $1",
        [email]
      );

      if (users.length === 0) {
        req.flash("failedInfo", `Email doesn't exist`);
        return res.redirect("/");
      }

      if (!bcrypt.compareSync(password, users[0].password)) {
        req.flash("failedInfo", "Password is Wrong");
        return res.redirect("/");
      }

      req.session.user = {
        email: users[0].email,
        usersid: users[0].id,
        avatar: users[0].avatar
      };
      req.flash("successInfo", "Anda Berhasil Login");
      return res.redirect("/todos");
    } catch (error) {
      console.log(error);
      return res.redirect("/");
    }
  });

  router.get("/register", function (req, res) {
    res.render("register", {
      failedInfo: req.flash("failedInfo"),
      successInfo: req.flash("successInfo")
    });
  });

  router.post("/register", async function (req, res) {
    const { email, password, repassword } = req.body;
    if (password !== repassword) {
      req.flash("failedInfo", "Password Is Wrong!");
      return res.redirect("/register");
    } else {
      const hash = bcrypt.hashSync(password, saltRounds);
      try {
        const { rows: users } = await db.query(
          "SELECT * FROM users WHERE email = $1",
          [email]
        );

        if (users.length > 0) {
          req.flash("failedInfo", "User Telah Tersedia");
          return res.redirect("/register");
        } else {
          await db.query(
            "INSERT INTO users (email, password) VALUES ($1, $2)",
            [email, hash]
          );
          req.flash("successInfo", "Successfully Registered, Please Sign In!");
          return res.redirect("/");
        }
      } catch (error) {
        console.log(error);
        return res.redirect("/register");
      }
    }
  });

  router.get("/logout", (req, res) => {
    req.session.destroy(function (err) {
      res.redirect("/");
    });
  });

  router.get('/upload/:id', isLoggedIn, (req, res) => {
    res.render('todos/avatar', { previewAvatar: req.session.user.avatar });
  });

  router.post('/upload/:id', isLoggedIn, async (req, res) => {
    let avatar;
    let uploadPath;
    if (!req.files || Object.keys(req.files).length === 0) {
      return res.status(400).send('No files were uploaded.');
    }

    avatar = req.files.avatar;
    let fileName = Date.now() + '-' + avatar.name;
    uploadPath = path.join(__dirname, '..', 'public', 'images', fileName);


    avatar.mv(uploadPath, async function (err) {
      if (err) {
        return res.status(500).send(err);
      }
      try {
        console.log(req.params);
        const { rows: users } = await db.query('SELECT * FROM users WHERE id = $1', [req.params.id]);
        if (users[0].avatar) {
          console.log('masuk');
          const filePath = path.join(__dirname, '..', 'public', 'images', users[0].avatar);
          try {
            console.log('masuk hapus');
            fs.unlinkSync(filePath);
          } catch (error) {
            console.log('masuk error');
            const { rows } = await db.query('UPDATE users SET avatar = $1 WHERE id = $2', [fileName, req.params.id]);
            res.redirect('/todos');
          }
        }
        console.log('test');
        const { rows } = await db.query('UPDATE users SET avatar = $1 WHERE id = $2', [fileName, req.params.id]);
        res.redirect('/todos');
      } catch (error) {
        res.send(error);
      }
    });
  });

  return router;
};
