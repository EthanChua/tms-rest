const dotenv = require('dotenv').config({ path: './config.env' });
const mysql = require('mysql2');
const nodemailer= require('nodemailer');
const bcrypt = require('bcryptjs');

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

exports.CreateTask= async (req, res, next) => {
  const { username, password, task_name, app_acronym } = req.body;
  let { task_description=null } = req.body
  
  //PS300: Check missing Mandatory fields
  if (!username || !password || !task_name || !app_acronym) {
    return res.json({code:"PS300"})
  }

  //PS301: Check invalid data type
  if (typeof username !== "string" || typeof password !== "string" || typeof task_name !== "string" || typeof app_acronym !== "string") {
    return res.json({code:"PS301"})
  }

  try{
    //Get user data
    const getUser = await pool.promise().query(`SELECT * FROM accounts WHERE username = ?`, [username]);
    const user = getUser[0][0];

    
    //A400: Check invalid user credentials
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.json({code:"A400"})
    }

    //A401: Check if user active
    if (user.isActive === 0) {
      return res.json({code:"A401"})
    }

    //D500: Check app does not exist
    let getApp = await pool.promise().query(`SELECT * FROM application WHERE app_acronym = ?`, [app_acronym]);
    let app = getApp[0][0];
    if(!app){
      return res.json({code:"D500"})
    }

    //AM600: Check permitted user
    if(!app.App_permit_Create || !Checkgroup(username, app.App_permit_Create)){
      return res.json({code:"AM600"})
    }

    let task_creator = username, task_owner= username, task_state = "Open", task_plan= null, task_app_acronym = app.App_Acronym, currentDate = new Date() 
    let dateTime= `Date: ${currentDate.getDate()}-${(currentDate.getMonth() + 1)}-${currentDate.getFullYear()} Time:${currentDate.getHours()}:${currentDate.getMinutes()}`, createDate= currentDate.getDate() + "-" + (currentDate.getMonth() + 1) + "-" + currentDate.getFullYear()
    const task_id= app.App_Acronym + "_" + app.App_Rnumber
    let task_notes= `\n[${dateTime}, User: ${username}, State: ${task_state}] Task ${task_id} created by ${task_creator}\n****************************************************************************************************************************************\n`

    //Create task
    const createTaskResult = await pool.promise().query(`INSERT INTO task (Task_name, Task_description, Task_notes, Task_id, Task_plan, Task_app_Acronym, Task_state, Task_creator, Task_owner, Task_createDate) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [task_name, task_description, task_notes, task_id, task_plan, task_app_acronym, task_state, task_creator, task_owner, createDate])
    
    //increase app_Rnumber
    if(createTaskResult[0].affectedRows>0){
      let NewRnumber=parseInt(app.App_Rnumber)
      NewRnumber++
      const updateRnumber = await pool.promise().query(`UPDATE application SET App_Rnumber = ? WHERE App_Acronym = ?`, [NewRnumber, app_acronym])
      //S100: Success
      return res.json({code:"S100", task_id: task_id})
    }

  } catch (e) {
    //Check if data exceed character limit
    if(e.errno===1406){
      console.log(e.errno, "Data exceed character limit")
      return res.json({code:"T700"})
    }
    //Check internal Server Error
    console.log(e.errno, "Internal Server Error")
    return res.json({code:"T701"})
  }
};

exports.GetTaskbyState= async (req, res, next) => {
  try{

  } catch (e) {
    //Check if data exceed character limit
    if(e.errno===1406){
      console.log(e.errno, "Data exceed character limit")
      return res.json({code:"T700"})
    }
    //Check internal Server Error
    console.log(e.errno, "Internal Server Error")
    return res.json({code:"T701"})
  }
};

exports.PromoteTask2Done= async (req, res, next) => {
  let 
  try{

  } catch (e) {
    //Check if data exceed character limit
    if(e.errno===1406){
      console.log(e.errno, "Data exceed character limit")
      return res.json({code:"T700"})
    }
    //Check internal Server Error
    console.log(e.errno, "Internal Server Error")
    return res.json({code:"T701"})
  }
};

async function Checkgroup(userid, groupname) {
  const query=`SELECT roles FROM accounts WHERE username = ? AND roles LIKE ?`
  const result = await pool.promise().query(query, [userid, `%${groupname}%`])

  if(result[0][0]){
    return true;
  } else {
    return false;
  }
};
