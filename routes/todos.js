// Mengimpor modul-modul yang diperlukan
var express = require('express');
var router = express.Router();
const path = require('path');
const fs = require('fs');
const moment = require('moment');
const { isLoggedIn } = require('../helpers/util');

// Mengekspor fungsi yang menerima parameter 'db'
module.exports = function (db) {
  // Menangani rute GET '/'
  router.get('/', isLoggedIn, async function (req, res, next) {
    try {
      // Mengekstrak parameter query dan data sesi
      const { page = 1, title, startDate, endDate, deadline, complete, type_search = "AND", sort = 'desc', typeSort = 'id' } = req.query;
      const { usersid } = req.session.user; // Mengambil ID pengguna dari data session
      
      // Menyiapkan variabel untuk paginasi dan query
      const limit = 5;
      const offset = (page - 1) * 5;
      const queries = [];
      const params = [usersid];
      
      // Mengambil data pengguna dari database
      const { rows: users } = await db.query("SELECT * FROM users WHERE id = $1", [usersid]);

      // Memulai query untuk menghitung total item dan mengambil data
      let sql = `SELECT * FROM todolist WHERE userid = $1`;
      let countSql = `SELECT COUNT(*) AS total FROM todolist WHERE userid = $1`;

      // Menambahkan kondisi pencarian berdasarkan judul
      if (title) {
        params.push(`%${title}%`);
        queries.push(`title ILIKE $${params.length}`);
      }

      // Menambahkan kondisi pencarian berdasarkan tanggal
      if (startDate && endDate) {
        params.push(startDate, endDate);
        queries.push(`deadline BETWEEN $${params.length - 1} AND $${params.length}`);
      } else if (startDate) {
        params.push(startDate);
        queries.push(`deadline >= $${params.length}`);
      } else if (endDate) {
        params.push(endDate);
        queries.push(`deadline <= $${params.length}`);
      }

      // Menambahkan kondisi pencarian berdasarkan status penyelesaian
      if (complete) {
        params.push(complete);
        queries.push(`complete = $${params.length}`);
      }

      // Menambahkan kondisi pencarian ke query utama
      if (queries.length > 0) {
        const whereClause = queries.join(` ${type_search} `);
        sql += ` AND (${whereClause})`;
        countSql += ` AND (${whereClause})`;
      }

      // Menambahkan pengurutan
      sql += ` ORDER BY ${typeSort} ${sort}`;

      // Menambahkan paginasi
      sql += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      params.push(limit, offset);

      // Menjalankan query untuk menghitung total item
      const { rows: countResult } = await db.query(countSql, params.slice(0, -2));
      const total = parseInt(countResult[0].total);
      const pages = Math.ceil(total / limit);

      console.log(req.url);
      

      // Membangun URL untuk paginasi
      const url = req.url == '/' ? `/?page=${page}&typeSort=${typeSort}&sort=${sort}` : req.url;

      console.log(params);
      
      
      // Menjalankan query utama untuk mengambil data todo
      const { rows: todos } = await db.query(sql, params);

      console.log(todos);
      

      // Merender halaman dengan data yang telah diambil
      res.render('todos/todo', {
        todos,
        query: req.query,
        pages,
        offset,
        page,
        moment,
        typeSort,
        sort,
        usersid,
        avatar: users[0].avatar,
        users: req.session.user,
        failedInfo: req.flash("failedInfo"),
        successInfo: req.flash("successInfo"),
        url,
      });
    } catch (err) {
      next(err);
    }
  });

  // Menangani rute GET '/add/:userid'
  router.get('/add/:userid', (req, res) => {
    // Merender halaman tambah todo
    res.render('todos/add', {
      users: req.session.users,
      failedInfo: req.flash("failedInfo"),
      successInfo: req.flash("successInfo")
    });
  });

  // Menangani rute POST '/add/:userid'
  router.post('/add/:userid', (req, res) => {
    // Menambahkan todo baru ke database
    db.query('INSERT INTO todolist (title, userid) VALUES ($1, $2)', [req.body.title, req.params.userid], (err) => {
      if (err) res.send(err);
      else res.redirect('/todos');
    });
  });

  // Menangani rute GET '/edit/:id'
  router.get('/edit/:id', isLoggedIn, async (req, res) => {
    const id = req.params.id;
    // Mengambil data todo yang akan diedit
    db.query('SELECT * FROM todolist WHERE id = $1', [id], (err, { rows: todos }) => {
      if (err) res.send(err);
      else {
        // Merender halaman edit todo
        res.render('todos/edit', {
          todo: todos[0],
          moment,
          failedInfo: req.flash("failedInfo"),
          successInfo: req.flash("successInfo")
        });
      }
    });
  });

  // Menangani rute POST '/edit/:id'
  router.post('/edit/:id', (req, res) => {
    const id = req.params.id;
    const { title, complete, deadline } = req.body;
    // Mengupdate todo di database
    db.query('UPDATE todolist SET title = $1, complete = $2, deadline = $3 WHERE id = $4', [title, Boolean(complete), deadline, id], (err) => {
      if (err) res.send(err);
      else {
        req.flash('successInfo', 'Todo Berhasil Diupdate');
        res.redirect('/todos');
      }
    });
  });

  // Menangani rute POST '/delete/:id'
  router.post('/delete/:id', (req, res) => {
    const id = req.params.id;
    // Menghapus todo dari database
    db.query('DELETE FROM todolist WHERE id = $1', [id], (err) => {
      if (err) {
        req.flash('failedInfo', 'Gagal menghapus todo');
        res.redirect('/todos');
      } else {
        req.flash('successInfo', 'Todo berhasil dihapus');
        res.redirect('/todos');
      }
    });
  });

  return router;
};
