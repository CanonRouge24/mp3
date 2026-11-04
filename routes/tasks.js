const mongoose = require("mongoose"),
      User = require("../models/user"),
      Task = require("../models/task"),
      { ok, fail, parseJsonParam, getQueryHandler } = require("../utils/query");

module.exports = function (router)
{
  router.route("/tasks")
  .get(
    async (request, response) =>
    {
      try
      {
        // Assign default limit of 100 tasks if not specified
        const query = { ...request.query };
        if (query.limit === undefined) query.limit = 100;

        const data = await getQueryHandler(Task, query);
        return ok(response, "Ok", data, 200);
      }
      catch (error)
      {
        if (error.message.startsWith("400"))
        {
          return fail(response, "Invalid JSON for query parameter(s)", 400);
        }

        // Else
        return fail(response, "Internal server error")
      }
    }
  )

  .post(
    async (request, response) =>
    {
      try
      {
        let {
          name,
          description,
          deadline,
          completed,
          assignedUser,
          assignedUserName
        } = request.body;

        // Ensure name is present
        if (typeof name !== "string" || name.trim() === "")
        {
          return fail(response, "Name of type string is required", 400);
        }

        // Ensure deadline is present
        if ([undefined, null, ""].includes(deadline))
        {
          return fail(response, "Deadline is required", 400);
        }

        // Ensure date is valid
        const deadlineDate = new Date(deadline);
        if (Number.isNaN(deadlineDate.getTime()))
        {
          return fail(response, "Deadline must be a valid date", 400);
        }

        // Default values
        if (description === undefined) description = "";
        if (completed === undefined) completed = false;
        if ([undefined, null].includes(assignedUser)) assignedUser = "";

        // Ensure description is a string
        if (typeof description !== "string")
        {
          return fail(response, "Description must be a string", 400);
        }

        // Ensure completed is a boolean
        if (typeof completed !== "boolean")
        {
          return fail(response, "Completed must be a boolean", 400);
        }

        // Ensure assignedUser is a string
        if (typeof assignedUser !== "string")
        {
          return fail(response, "assignedUser must be a string", 400);
        }

        let user = null;

        if (assignedUser === "")
        {
          assignedUserName = "unassigned";
        }
        else
        {
          // Ensure id is valid
          if (typeof assignedUser !== "string" || !mongoose.isValidObjectId(assignedUser))
          {
            return fail(response, "Invalid assignedUser id", 400);
          }

          // Ensure id actually exists
          user = await User.findById(assignedUser);

          if (!user)
          {
            return fail(response, "assignedUser not found", 404);
          }

          // Default value for assignedUserName
          if (assignedUserName === undefined)
          {
            assignedUserName = user.name;
          }

          // Ensure assignedUserName matches
          if (assignedUserName !== user.name)
          {
            return fail(response, "assignedUserName does not match the assignedUser", 400);
          }
        }

        const task = await Task.create(
          {
            name,
            description,
            deadline: deadlineDate,
            completed,
            assignedUser,
            assignedUserName
          }
        );

        // Assign to user if assigned and not completed
        if (user && !completed)
        {
          await User.updateOne(
            { _id: user._id },
            { $addToSet: { pendingTasks: String(task._id) } }
          );
        }

        return ok(response, "Task created", task, 201);
      }
      catch (error)
      {
        return fail(response, "Internal server error", 500);
      }
    }
  );


  router.route("/tasks/:id")
  .get(
    async (request, response) =>
    {
      const { id } = request.params;

      try
      {
        // Ensure ObjectId is valid
        if (!mongoose.isValidObjectId(id))
        {
          return fail(response, "Task not found", 404);
        }

        // Else
        let q = Task.findById(id),
            select = parseJsonParam(request.query.select);

        if (select) q = q.select(select);
        const task = await q.exec();

        if (!task)
        {
          return fail(response, "Task not found", 404);
        }

        // Else
        return ok(response, "Ok", task, 200);
      }
      catch (error)
      {
        if (error.message.startsWith("400"))
        {
          return fail(response, "Invalid JSON for query parameter", 400);
        }

        // Else
        return fail(response, "Internal server error", 500);
      }
    }
  )

  .put(
    async (request, response) =>
    {
      try
      {
        // Ensure ObjectId is valid
        if (!mongoose.isValidObjectId(id))
        {
          return fail(response, "Task not found", 404);
        }

        const task = await Task.findById(id);

        if (!task)
        {
          return fail(response, "Task not found", 404);
        }

        let {
          name,
          description,
          deadline,
          completed,
          assignedUser,
          assignedUserName
        } = request.body;

        // Ensure name is present
        if (typeof name !== "string" || name.trim() === "")
        {
          return fail(response, "Name of type string is required", 400);
        }

        // Ensure deadline is present
        if ([undefined, null, ""].includes(deadline))
        {
          return fail(response, "Deadline is required", 400);
        }

        // Ensure date is valid
        const deadlineDate = new Date(deadline);

        if (Number.isNaN(deadlineDate.getTime()))
        {
          return fail(response, "Deadline must be a valid date", 400);
        }

        // Default values
        if (description === undefined) description = "";
        if (completed === undefined) completed = false;
        if ([undefined, null].includes(assignedUser)) assignedUser = "";

        // Ensure description is a string
        if (typeof description !== "string")
        {
          return fail(response, "Description must be a string", 400);
        }

        // Ensure completed is a boolean
        if (typeof completed !== "boolean")
        {
          return fail(response, "Completed must be a boolean", 400);
        }

        // Ensure assignedUser is a string
        if (typeof assignedUser !== "string")
        {
          return fail(response, "assignedUser must be a string", 400);
        }


        const previousUserId = task.assignedUser;
        let user = null;

        if (assignedUser === "")
        {
          assignedUserName = "unassigned";
        }
        else
        {
          // Ensure id is valid
          if (typeof assignedUser !== "string" || !mongoose.isValidObjectId(assignedUser))
          {
            return fail(response, "Invalid assignedUser id", 400);
          }

          // Ensure id actually exists
          user = await User.findById(assignedUser);

          if (!user)
          {
            return fail(response, "assignedUser not found", 404);
          }

          // Default value for assignedUserName
          if (assignedUserName === undefined)
          {
            assignedUserName = user.name;
          }

          // Ensure assignedUserName matches
          if (assignedUserName !== user.name)
          {
            return fail(response, "assignedUserName does not match the assignedUser", 400);
          }
        }

        // Apply replacement
        task.name = name;
        task.description = description;
        task.deadline = deadlineDate;
        task.completed = completed;
        task.assignedUser = assignedUser;
        task.assignedUserName = assignedUserName;

        await task.save();

        // Remove from previous user's pendingTasks if assignee or completion state changed
        if (previousUserId && previousUserId !== assignedUser)
        {
          await User.updateOne(
            { _id: previousUserId },
            { $pull: { pendingTasks: String(task._id) } }
          );
        }

        // Add or remove task from pendingTasks based on whether it's completed
        if (assignedUser !== "")
        {
          await User.updateOne(
            { _id: assignedUser },
            { [completed ? "$pull" : "$addToSet" ]: { pendingTasks: String(task._id) } }
          );
        }

        return ok(response, "Task updated", task, 200);
      }
      catch (error)
      {
        return fail(response, "Internal server error", 500);
      }
    }
  )

  .delete(
    async (request, response) =>
    {
      const { id } = request.params;

      try
      {
        // Ensure ObjectId is valid
        if (!mongoose.isValidObjectId)
        {
          return fail(response, "Task not found", 404);
        }

        const task = await Task.findById(id);

        if (!task)
        {
          return fail(response, "Task not found", 404);
        }

        // Remove from assigned user's pending tasks, if assigned
        if (task.assignedUser)
        {
          await User.updateOne(
            { _id: task.assignedUser },
            { $pull: { pendingTasks: String(task._id) } }
          );
        }

        // Delete task
        await Task.deleteOne(
          { _id: String(task._id) }
        );

        return ok(response, "Task deleted", task, 200);
      }
      catch (error)
      {
        return fail(response, "Internal server error", 500);
      }
    }
  );

  return router;
}
