function ok (response, message, data, status)
{
  return response.status(status).json(
    {
      message,
      data
    }
  );
}

function fail (response, message, status)
{
  return response.status(status).json(
    {
      message,
      data: ""
    }
  );
}

function parseJsonParam (string)
{
  // Parameter pair doesn't even exist
  if (string === undefined)
  {
    return;
  }

  // Else
  try
  {
    return JSON.parse(string);
  }
  catch (error)
  {
    throw Error(error);
  }
}

async function getQueryHandler (model, query)
{
  let { where, sort, select, skip, limit, count } = query;

  try
  {
    where = parseJsonParam(where) ?? {};
  }
  catch (error)
  {
    throw new Error("400 | where");
  }

  try
  {
    sort = parseJsonParam(sort);
  }
  catch (error)
  {
    throw new Error("400 | sort");
  }

  try
  {
    select = parseJsonParam(select);
  }
  catch (error)
  {
    throw new Error("400 | select");
  }

  skip = (skip !== undefined) ? +skip : undefined;
  if (Number.isNaN(skip)) skip = undefined;

  limit = (limit !== undefined) ? +limit : undefined;
  if (Number.isNaN(limit)) limit = undefined;

  count = count === "true" || count === true;

  // We can ignore everything except where for counting
  if (count)
  {
    return await model.countDocuments(where);
  }

  // Else
  let q = model.find(where);

  if (sort) q = q.sort(sort);
  if (select) q = q.select(select);
  if (typeof skip === "number") q = q.skip(skip);
  if (typeof limit === "number") q = q.limit(limit);

  return await q.exec();
}

module.exports = { ok, fail, parseJsonParam, getQueryHandler };
