// Impor modul yang diperlukan
var createError = require("http-errors"); // Untuk membuat error HTTP
var express = require("express"); // Framework aplikasi web
var path = require("path"); // Untuk menangani jalur file
var cookieParser = require("cookie-parser"); // Mengurai header Cookie dan mengisi req.cookies
var logger = require("morgan"); // Middleware logger permintaan HTTP
var session = require("express-session"); // Middleware sesi
var flash = require("connect-flash"); // Untuk menyimpan pesan sementara
const fileUpload = require("express-fileupload"); // Middleware untuk menangani unggahan file

// Menyiapkan koneksi database PostgreSQL
const { Pool } = require("pg");
const pool = new Pool({
  user: "raven",
  password: "adzka123",
  host: "localhost",
  port: 5432,
  database: "todolist"
});

// Impor dan inisialisasi router dengan pool database
var indexRouter = require("./routes/index")(pool);
var todosRouter = require("./routes/todos")(pool);

// Membuat aplikasi Express
var app = express();

// Mengkonfigurasi mesin tampilan
app.set("views", path.join(__dirname, "views")); // Mengatur direktori tampilan
app.set("view engine", "ejs"); // Menggunakan EJS sebagai mesin template

// Menyiapkan middleware
app.use(logger("dev")); // Mencatat permintaan HTTP
app.use(express.json()); // Mengurai req.body JSON
app.use(express.urlencoded({ extended: false })); // Mengurai req.body URL-encoded
app.use(cookieParser()); // Mengurai cookie
app.use(express.static(path.join(__dirname, "public"))); // Menyajikan file statis

// Mengkonfigurasi middleware sesi
app.use(
  session({
    secret: "raven",
    resave: false,
    saveUninitialized: true
  })
);

app.use(flash()); // Mengaktifkan pesan flash
app.use(fileUpload()); // Mengaktifkan unggahan file

// Menyiapkan rute
app.use("/", indexRouter);
app.use("/todos", todosRouter);

// Penangan error 404
app.use(function (req, res, next) {
  next(createError(404));
});

// Penangan error global
app.use(function (err, req, res, next) {
  // Mengatur lokal, hanya menyediakan error dalam pengembangan
  res.locals.message = err.message;
  res.locals.error = req.app.get("env") === "development" ? err : {};

  // Merender halaman error
  res.status(err.status || 500);
  res.render("error");
});

// Mengekspor aplikasi
module.exports = app;
