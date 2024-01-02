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
    if(!app.App_permit_Create || !(await Checkgroup(username, app.App_permit_Create))){
      return res.json({code:"AM600"})
    }

    let task_creator = username, task_owner= username, task_state = "Open", task_plan= null, task_app_acronym = app.App_Acronym, currentDate = new Date() 
    let dateTime= `Date: ${currentDate.getDate()}-${(currentDate.getMonth() + 1)}-${currentDate.getFullYear()} Time:${currentDate.getHours()}:${currentDate.getMinutes()}`, createDate= currentDate.getDate() + "-" + (currentDate.getMonth() + 1) + "-" + currentDate.getFullYear()
    const task_id= app.App_Acronym + "_" + app.App_Rnumber
    let task_notes= `\n[${dateTime}, User: ${username}, State: ${task_state}] Task ${task_id} created by ${task_creator}\n___________________________________________________________________________________________________________________\n`

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
    if(e.errono== 1264){
      console.log(e.errno, "Out of range value for column")
      return res.json({code:"T700"})
    }
    //Check internal Server Error
    console.log(e.errno, "Internal Server Error")
    return res.json({code:"T701"})
  }
};

exports.GetTaskbyState= async (req, res, next) => {
  const { username, password, task_state, task_app_acronym } = req.body;

  //PS300: Check missing Mandatory fields
  if(!username || !password || !task_state || !task_app_acronym){
    return res.json({code:"PS300"})
  }

  //PS301: Check invalid data type
  if (typeof username !== "string" || typeof password !== "string" || typeof task_state !== "string" || typeof task_app_acronym !== "string") {
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
    let getApp = await pool.promise().query(`SELECT * FROM application WHERE app_acronym = ?`, [task_app_acronym]);
    let app = getApp[0][0];
    if(!app){
      return res.json({code:"D500"})
    }

    //D501: Check if any task exist @TOCHECK if GetTaskbyState means all task within single app or all task in all app
    let getTask = await pool.promise().query(`SELECT * FROM task WHERE Task_app_acronym = ?`, [task_app_acronym]);
    let checkTask = getTask[0][0];
    if(!checkTask){
      return res.json({code:"D501"})
    }

    //Check for valid task state input and convert to DB format
    let taskState
    switch (task_state) {
      case "open":
        taskState = "Open"
        break;
      case "todo":
        taskState = "Todo"
        break;
      case "doing":
        taskState = "Doing"
        break;
      case "done":
        taskState = "Done"
        break;
      case "closed":
        taskState = "Close"
        break;
      default:
        return res.json({code:"D502"})
        }

    //Get task data
    const result = await pool.promise().query(`SELECT * FROM task WHERE Task_state = ? AND Task_app_acronym = ?`, [task_state, task_app_acronym])
    const task = result[0]

    return res.json({code:"S100", data: task})

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
  const { username, password, task_id, task_app_acronym } = req.body
  let {new_notes=null} = req.body

  //PS300: Check missing Mandatory fields
  if(!username || !password || !task_id || !task_app_acronym){
    return res.json({code:"PS300"})
  }
  
  //PS301: Check invalid data type
  if (typeof username !== "string" || typeof password !== "string" || typeof task_id !== "string" || typeof task_app_acronym !== "string") {
    return res.json({code:"PS301"})
  }

  try{
    //Get user data
    const getUser = await pool.promise().query(`SELECT * FROM accounts WHERE username = ?`, [username]);
    const user = getUser[0][0];
    let sendEmail = false;
    
    
    //A400: Check invalid user credentials
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.json({code:"A400"})
    }
    
    //A401: Check if user active
    if (user.isActive === 0) {
      return res.json({code:"A401"})
    }
    
    
    //D500: Check app does not exist
    let getApp = await pool.promise().query(`SELECT * FROM application WHERE app_acronym = ?`, [task_app_acronym]);
    let app = getApp[0][0];
    if(!app){
      return res.json({code:"D500"})
    }

    //get task data
    let getTask = await pool.promise().query(`SELECT * FROM task WHERE Task_id = ? `, [task_id]);
    const task =getTask[0][0]
    //D501: Check if task exist
    if(!task){
      return res.json({code:"D501"})
    }

    //Check task state if in doing
    if(task.Task_state !== "doing" && task.Task_state !== "Doing"){
      return res.json({code:"D502"})
    } 

    //Check permitted user
    if(!app.App_permit_Doing || !(await Checkgroup(username, app.App_permit_Doing))){
      return res.json({code:"AM600"})
    }

    let task_owner= username, currentDate = new Date() 
    let dateTime= `Date: ${currentDate.getDate()}-${(currentDate.getMonth() + 1)}-${currentDate.getFullYear()} Time:${currentDate.getHours()}:${currentDate.getMinutes()}`
    //Promote task to done
    const promoteTaskResult = await pool.promise().query(`UPDATE task SET Task_state = ?, task_owner = ?  WHERE Task_id = ?`, ["Done", task_owner, task_id])
    if(promoteTaskResult[0].affectedRows>0){
      //Update task notes
      let auditNote = `\n[${dateTime}, User: ${username}, State: doing] Task ${task_id} promoted to done by ${task_owner}\n__________________________________________________________________________________________________________________________\n`
      if(new_notes !== null && new_notes !== ""){
        auditNote = auditNote + "Note: " + new_notes + " \n_______________________________________________________________________________________________________________________________________\n"
      }
      const updateTaskNotes = await pool.promise().query(`UPDATE task SET Task_notes = CONCAT(?, Task_notes) WHERE Task_id = ?`, [auditNote, task_id])
      //S100: Success
      sendEmail = true;
          //Send email to project lead
      if(sendEmail){
        let transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: process.env.SMTP_PORT,
          auth: {
              user : process.env.SMTP_EMAIL,
              pass : process.env.SMTP_PASSWORD
          }
        })

        let message ={
          from: `${process.env.SMTP_FROM_NAME} <${process.env.SMTP_FROM_EMAIL}>`,
          to: process.env.SMTP_TO_EMAIL,
          subject: `Task Done`,
          text: `${task_id} promoted to Done`
        };
    
      transporter.sendMail(message, function(error, info) {
        if (error){
          console.log(error)
        } else {
          console.log("Email Sent to Project Lead")
        }
      });
    }
      console.log("Email Sent to Project Lead")
      return res.json({code:"S100"})
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

async function Checkgroup(userid, groupname) {
  const query=`SELECT roles FROM accounts WHERE username = ? AND roles LIKE ?`
  const result = await pool.promise().query(query, [userid, `%${groupname}%`])

  if(result[0][0]){
    return true;
  } else {
    return false;
  }
};
