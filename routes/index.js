// Impor modul yang diperlukan
var express = require("express");
var router = express.Router();
const bcrypt = require("bcrypt");
const saltRounds = 10;
const path = require("path");
const fs = require("fs");
const { isLoggedIn } = require("../helpers/util");

// Ekspor fungsi yang menerima koneksi database sebagai parameter
module.exports = (db) => {
  // Mendefinisikan rute untuk permintaan GET ke URL root
  router.get("/", function (req, res) {
    // Render halaman login dengan pesan flash
    res.render("login", {
      failedInfo: req.flash("failedInfo"),
      successInfo: req.flash("successInfo")
    });
  });

  // Mendefinisikan rute untuk permintaan POST ke URL root (login)
  router.post("/", async (req, res) => {
    try {
      // Ekstrak email dan password dari body permintaan
      const { email, password } = req.body;
      // Query database untuk pengguna dengan email yang cocok
      const { rows: users } = await db.query(
        "SELECT * FROM users WHERE email = $1",
        [email]
      );

      // Jika pengguna tidak ditemukan, kirim pesan error dan redirect ke login
      if (users.length === 0) {
        req.flash("failedInfo", `Email tidak terdaftar`);
        return res.redirect("/");
      }

      // Jika password tidak cocok, kirim pesan error dan redirect ke login
      if (!bcrypt.compareSync(password, users[0].password)) {
        req.flash("failedInfo", "Password Salah");
        return res.redirect("/");
      }

      // Jika login berhasil, set session dan redirect ke halaman todos
      req.session.user = {
        email: users[0].email,
        usersid: users[0].id,
        avatar: users[0].avatar
      };
      req.flash("successInfo", "Anda Berhasil Login");
      return res.redirect("/todos");
    } catch (error) {
      // Jika terjadi error, log error dan redirect ke login
      console.log(error);
      return res.redirect("/");
    }
  });

  // Mendefinisikan rute untuk permintaan GET ke halaman register
  router.get("/register", function (req, res) {
    // Render halaman register dengan pesan flash
    res.render("register", {
      failedInfo: req.flash("failedInfo"),
      successInfo: req.flash("successInfo")
    });
  });

  // Mendefinisikan rute untuk permintaan POST ke halaman register
  router.post("/register", async function (req, res) {
    // Ekstrak email, password, dan repassword dari body permintaan
    const { email, password, repassword } = req.body;
    // Jika password tidak cocok, kirim pesan error dan redirect ke halaman register
    if (password !== repassword) {
      req.flash("failedInfo", "Password Tidak Cocok!");
      return res.redirect("/register");
    } else {
      // Hash password
      const hash = bcrypt.hashSync(password, saltRounds);
      try {
        // Cek apakah pengguna dengan email tersebut sudah ada
        const { rows: users } = await db.query(
          "SELECT * FROM users WHERE email = $1",
          [email]
        );

        if (users.length > 0) {
          // Jika pengguna sudah ada, kirim pesan error dan redirect ke halaman register
          req.flash("failedInfo", "User Telah Tersedia");
          return res.redirect("/register");
        } else {
          // Jika pengguna belum ada, masukkan pengguna baru ke database
          await db.query(
            "INSERT INTO users (email, password) VALUES ($1, $2)",
            [email, hash]
          );
          // Kirim pesan sukses dan redirect ke halaman login
          req.flash("successInfo", "Berhasil Mendaftar, Silakan Masuk!");
          return res.redirect("/");
        }
      } catch (error) {
        // Jika terjadi error, log error dan redirect ke halaman register
        console.log(error);
        return res.redirect("/register");
      }
    }
  });

  // Mendefinisikan rute untuk permintaan GET ke logout
  router.get("/logout", (req, res) => {
    // Hancurkan session dan redirect ke halaman login
    req.session.destroy(function (err) {
      res.redirect("/");
    });
  });

  // Mendefinisikan rute untuk permintaan GET ke halaman upload avatar
  router.get('/upload/:id', isLoggedIn, (req, res) => {
    // Render halaman avatar dengan avatar saat ini
    res.render('todos/avatar', { previewAvatar: req.session.user.avatar });
  });

  // Mendefinisikan rute untuk permintaan POST untuk upload avatar
  router.post('/upload/:id', isLoggedIn, async (req, res) => {
    let avatar;
    let uploadPath;
    // Cek apakah file telah diupload
    if (!req.files || Object.keys(req.files).length === 0) {
      return res.status(400).send('Tidak ada file yang diupload.');
    }

    // Dapatkan file avatar dan buat nama file unik
    avatar = req.files.avatar;
    let fileName = Date.now() + '-' + avatar.name;
    uploadPath = path.join(__dirname, '..', 'public', 'images', fileName);

    // Pindahkan file yang diupload ke path upload
    avatar.mv(uploadPath, async function (err) {
      if (err) {
        return res.status(500).send(err);
      }
      try {
        // Dapatkan pengguna dari database
        const { rows: users } = await db.query('SELECT * FROM users WHERE id = $1', [req.params.id]);
        if (users[0].avatar) {
          // Jika pengguna sudah memiliki avatar, coba hapus file lama
          const filePath = path.join(__dirname, '..', 'public', 'images', users[0].avatar);
          try {
            fs.unlinkSync(filePath);
          } catch (error) {
            // Jika terjadi error saat menghapus file lama, update database dan redirect
            const { rows } = await db.query('UPDATE users SET avatar = $1 WHERE id = $2', [fileName, req.params.id]);
            res.redirect('/todos');
          }
        }
        // Update avatar pengguna di database
        const { rows } = await db.query('UPDATE users SET avatar = $1 WHERE id = $2', [fileName, req.params.id]);
        res.redirect('/todos');
      } catch (error) {
        res.send(error);
      }
    });
  });

  // Mengembalikan router
  return router;
};
