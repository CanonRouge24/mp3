// Load required packages
const mongoose = require("mongoose");

const TaskSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: { type: String, default: "" },
    deadline: { type: Date, required: true },
    completed: { type: Boolean, required: false },
    assignedUser: { type: String, default: "" },
    assignedUserName: { type: String, default: "unassigned" },
    dateCreated: { type: Date, default: Date.now }
  }
);

// Export the Mongoose model
const TaskModel = mongoose.model("Task", TaskSchema);

export { TaskModel as TaskSchema };
