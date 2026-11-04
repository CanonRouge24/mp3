const mongoose = require("mongoose"),
      User = require("../models/user"),
      Task = require("../models/task"),
      { ok, fail, parseJsonParam, getQueryHandler } = require("../utils/query");

module.exports = function (router)
{
  router.route("/users")
  .get(
    async (request, response) =>
    {
      try
      {
        const data = await getQueryHandler(User, request.query);
        return ok(response, "Ok", data, 200);
      }
      catch (error)
      {
        if (error.message.startsWith("400"))
        {
          return fail(response, "Invalid JSON for query parameter(s)", 400);
        }

        // Else
        return fail(response, "Internal server error", 500);
      }
    }
  )

  .post(
    async (request, response) =>
    {
      try
      {
        const { name, email } = request.body;
        let { pendingTasks } = request.body;

        // Ensure name is present
        if (typeof name !== "string" || name.trim() === "")
        {
          return fail(response, "Name of type string is required to create user", 400);
        }

        // Ensure email is present
        if (typeof email !== "string" || email.trim() === "")
        {
          return fail(response, "Email of type string is required to create user", 400);
        }

        // Default value for pending tasks
        if (pendingTasks === undefined) pendingTasks = [];

        // Ensure pendingTasks is an array
        if (!Array.isArray(pendingTasks))
        {
          return fail(response, "pendingTasks should be an array", 400);
        }

        // Ensure all the task ids are valid
        for (const taskId of pendingTasks)
        {
          if (typeof taskId !== "string" || !mongoose.isValidObjectId(taskId))
          {
            return fail(response, "Invalid task id in pendingTasks", 400);
          }
        }

        // Ensure email is unique
        if (await User.findOne({ email }))
        {
          return fail(response, "Email already in use", 400);
        }

        const tasks = await Task.find({ _id: { $in: pendingTasks } });


        // Ensure all the tasks exist
        if (tasks.length !== pendingTasks.length)
        {
          return fail(response, "One or more tasks not found", 404);
        }

        // Ensure none of the tasks are already completed
        if (tasks.some(task => task.completed))
        {
          return fail(response, "One or more tasks already completed", 400);
        }

        // Create user
        const user = await User.create(
          {
            name,
            email,
            pendingTasks
          }
        );

        // Sync tasks, adding and removing as needed
        for (const task of tasks)
        {
          if (task.assignedUser !== undefined && task.assignedUser !== String(user._id))
          {
            await User.updateOne(
              { _id: task.assignedUser },
              { $pull: { pendingTasks: String(task._id) } }
            );
          }

          task.assignedUser = String(user._id);
          task.assignedUserName = user.name;

          await task.save();
        }

        return ok(response, "User created", user, 201);
      }
      catch (error)
      {
        return fail(response, "Internal server error", 500);
      }
    }
  );


  router.route("/users/:id")
  .get(
    async (request, response) =>
    {
      const { id } = request.params;

      try
      {
        // Ensure ObjectId is valid
        if (!mongoose.isValidObjectId(id))
        {
          return fail(response, "User not found", 404);
        }

        // Else
        let q = User.findById(id),
            select = parseJsonParam(request.query.select);

        if (select) q = q.select(select);
        const user = await q.exec();

        if (!user)
        {
          return fail(response, "User not found", 404);
        }

        // Else
        return ok(response, "Ok", user, 200);
      }
      catch (error)
      {
        if (error.message.startsWith("400"))
        {
          return fail(response, "Invalid JSON for query parameter", 400);
        }
      }
    }
  )

  .put(
    async (request, response) =>
    {
      const { id } = request.params;

      try
      {
        // Ensure ObjectId is valid
        if (!mongoose.isValidObjectId(id))
        {
          return fail(response, "User not found", 404);
        }

        const user = await User.findById(id);

        if (!user)
        {
          return fail(response, "User not found", 404);
        }

        const { name, email } = request.body;
        let { pendingTasks } = request.body;

        // Ensure name is present
        if (typeof name !== "string" || name.trim() === "")
        {
          return fail(response, "Name of type string is required", 400);
        }

        // Ensure email is present
        if (typeof email !== "string" || email.trim() === "")
        {
          return fail(response, "Email of type string is required", 400);
        }

        // Default value for pending tasks
        if (pendingTasks === undefined) pendingTasks = [];

        // Ensure pendingTasks is an array
        if (!Array.isArray(pendingTasks))
        {
          return fail(response, "pendingTasks should be an array", 400);
        }

        // Ensure all the task ids are valid
        for (const taskId of pendingTasks)
        {
          if (typeof taskId !== "string" || !mongoose.isValidObjectId(taskId))
          {
            return fail(response, "Invalid task id in pendingTasks", 400);
          }
        }

        // Ensure email isn't changed the same or is unused
        const emailOwner = await User.findOne({ email });

        if (emailOwner && String(emailOwner._id) !== String(user._id))
        {
          return fail(response, "Email already in use", 400);
        }

        // Ensure all the tasks exist
        const tasks = await Task.find({ _id: { $in: pendingTasks } });

        if (tasks.length !== pendingTasks.length)
        {
          return fail(response, "One or more tasks not found", 404);
        }

        // Ensure none of the tasks are already completed
        if (tasks.some(task => task.completed))
        {
          return fail(response, "One or more tasks already completed", 400);
        }

        // Update tasks as necessary
        const oldPending = user.pendingTasks.map(String),
              newPending = pendingTasks.map(String)

              oldSet = new Set(oldPending),
              newSet = new Set(newPending),

              // Tasks added and removed in the update
              removed = oldSet.filter(task => !newSet.has(task)),
              added = newSet.filter(task => !oldSet.has(task));

        user.name = name;
        user.email = email;
        user.pendingTasks = newPending;
        await user.save();

        // Unassign any tasks that were removed
        if (removed.length > 0)
        {
          await Task.updateMany(
            { _id: { $in: removed } },
            {
              $set: {
                assignedUser: "",
                assignedUserName: "unassigned"
              }
            }
          );
        }

        // Assign any tasks that were added
        const taskById = new Map(
          tasks.map(
            task => [String(task._id), task]
          )
        );

        for (const taskId of added)
        {
          const task = taskById.get(taskId);

          if (task.assignedUser && task.assignedUser !== String(user._id))
          {
            await User.updateOne(
              { _id: task.assignedUser },
              { $pull: { pendingTasks: String(task._id) } }
            );
          }

          task.assignedUser = String(user._id);
          task.assignedUserName = user.name;

          await task.save();
        }

        // Update assignedUserName for all the tasks
        await Task.updateMany(
          { assignedUser: String(user._id) },
          { $set: { assignedUserName: user.name } }
        );

        return ok(response, "User updated", user, 200);
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
        if (!mongoose.isValidObjectId(id))
        {
          return fail(response, "User not found", 404);
        }

        const user = await User.findById(id);

        if (!user)
        {
          return fail(response, "User not found", 404);
        }

        // Unassign all their tasks, including completed ones
        await Task.updateMany(
          { assignedUser: String(user._id) },
          { $set: { assignedUser: "", assignedUserName: "unassigned" } }
        );

        await User.deleteOne(
          { _id: user._id }
        );

        return ok(response, "User deleted", user, 204);
      }
      catch (error)
      {
        return fail(response, "Internal server error", 500);
      }
    }
  );

  return router;
};
