const express = require("express");
const router = express.Router();
const dotenv = require('dotenv').config({ path: './config.env' });
const cors = require('cors')

const { CreateTask, GetTaskbyState, PromoteTask2Done } = require("./controller");

const app = express();
app.use(express.json());
app.use(cors('http://localhost:3000'));
app.use(router); 

//routes
router.route("/CreateTask").post(CreateTask)
router.route("/GetTaskbyState").post(GetTaskbyState)
router.route("/PromoteTask2Done").post(PromoteTask2Done)

// AS200 && AS201: Check if endpoint exist and special character
app.all("*", (req, res) => {
  const regex = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]+/
  if(regex.test(req.url.slice(1))){
  return res.json({ code: "AS201"})
  }
  return res.json({ code: "AS200"})
})

const PORT = process.env.PORT;
app.listen(PORT, () => 
    console.log(`Server running on port ${PORT}`)
);