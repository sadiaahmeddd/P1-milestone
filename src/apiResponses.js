const querystring = require('querystring');

let pokemonList = []; // 

//dataset at startup
const init = (data) => {
 
  if (Array.isArray(data)) {
    pokemonList = data;
    return;
  }
  if (data && Array.isArray(data.pokemon)) {
    pokemonList = data.pokemon;
    return;
  }

  pokemonList = [];
};

// Content-Type 
const sendJSON = (response, statusCode, obj, headOnly) => {
  const payload = JSON.stringify(obj);

  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
  });

  if (!headOnly) {
    response.write(payload);
  }

  response.end();
};

const sendNoContent = (response, statusCode) => {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': 0,
  });
  response.end();
};

const sendError = (response, statusCode, message, headOnly) =>
  sendJSON(response, statusCode, { error: message }, headOnly);

// POST body 
const parseBody = (request, callback) => {
  let body = '';

  request.on('data', (chunk) => {
    body += chunk.toString();
  });

  request.on('end', () => {
    const contentType = request.headers['content-type'] || '';

    if (contentType.includes('application/json')) {
      try {
        const parsed = JSON.parse(body || '{}');
        return callback(null, parsed);
      } catch (e) {
        return callback(new Error('Invalid JSON body'), null);
      }
    }

    if (contentType.includes('application/x-www-form-urlencoded')) {
      const parsed = querystring.parse(body);
      return callback(null, parsed);
    }

    return callback(
      new Error('Unsupported Content-Type. Use application/json or application/x-www-form-urlencoded'),
      null
    );
  });
};

//GET/HEAD endpoints

// GET 
const getPokemon = (request, response, headOnly, query) => {
  if (!Array.isArray(pokemonList) || pokemonList.length === 0) {
    return sendError(response, 500, 'Dataset not loaded correctly', headOnly);
  }

  let results = [...pokemonList];

  // name filter 
  if (query.name) {
    const needle = String(query.name).toLowerCase();
    results = results.filter((p) => String(p.name).toLowerCase().includes(needle));
  }

  // type filter 
  if (query.type) {
    const typeNeedle = String(query.type).toLowerCase();
    results = results.filter(
      (p) => Array.isArray(p.type) && p.type.some((t) => String(t).toLowerCase() === typeNeedle)
    );
  }

  // weakness filter 
  if (query.weakness) {
    const weakNeedle = String(query.weakness).toLowerCase();
    results = results.filter(
      (p) =>
        Array.isArray(p.weaknesses) &&
        p.weaknesses.some((w) => String(w).toLowerCase() === weakNeedle)
    );
  }

  // limit
  if (query.limit) {
    const limitNum = Number(query.limit);
    if (Number.isNaN(limitNum) || limitNum < 1) {
      return sendError(response, 400, 'limit must be a positive number', headOnly);
    }
    results = results.slice(0, limitNum);
  }

  return sendJSON(response, 200, { count: results.length, pokemon: results }, headOnly);
};

// GET 
const getPokemonById = (request, response, headOnly, query) => {
  if (!query.id) {
    return sendError(response, 400, 'Missing required query param: id', headOnly);
  }

  const idNum = Number(query.id);
  if (Number.isNaN(idNum)) {
    return sendError(response, 400, 'id must be a number', headOnly);
  }

  const match = pokemonList.find((p) => Number(p.id) === idNum);
  if (!match) {
    return sendError(response, 404, `No pokemon found with id=${idNum}`, headOnly);
  }

  return sendJSON(response, 200, match, headOnly);
};

// GET 
const getPokemonByNum = (request, response, headOnly, query) => {
  if (!query.num) {
    return sendError(response, 400, 'Missing required query param: num', headOnly);
  }

  const numStr = String(query.num);
  const match = pokemonList.find((p) => String(p.num) === numStr);
  if (!match) {
    return sendError(response, 404, `No pokemon found with num=${numStr}`, headOnly);
  }

  return sendJSON(response, 200, match, headOnly);
};

// /api/types
const getTypes = (request, response, headOnly) => {
  const typeSet = new Set();

  pokemonList.forEach((p) => {
    if (Array.isArray(p.type)) {
      p.type.forEach((t) => typeSet.add(String(t)));
    }
  });

  return sendJSON(response, 200, { types: [...typeSet].sort() }, headOnly);
};

// POST endpoints

// POST 
//
const addPokemon = (request, response) => {
  return parseBody(request, (err, body) => {
    if (err) {
      return sendError(response, 400, err.message, false);
    }

    const { id, num, name } = body;
    let { type } = body;

    if (!id || !num || !name || !type) {
      return sendError(response, 400, 'Required fields: id, num, name, type', false);
    }

    const idNum = Number(id);
    if (Number.isNaN(idNum)) {
      return sendError(response, 400, 'id must be a number', false);
    }

    // type 
    if (Array.isArray(type)) {
      type = type.map((t) => String(t).trim()).filter(Boolean);
    } else {
      type = String(type).split(',').map((t) => t.trim()).filter(Boolean);
    }

    if (type.length === 0) {
      return sendError(response, 400, 'type must have at least one value', false);
    }

    const exists = pokemonList.some((p) => Number(p.id) === idNum || String(p.num) === String(num));
    if (exists) {
      return sendError(response, 400, 'A pokemon with that id or num already exists', false);
    }

    const newPokemon = {
      id: idNum,
      num: String(num),
      name: String(name),
      type,
    };

    pokemonList.push(newPokemon);
    return sendJSON(response, 201, { message: 'Created', pokemon: newPokemon }, false);
  });
};

// POST /api/editPokemon

const editPokemon = (request, response) => {
  return parseBody(request, (err, body) => {
    if (err) {
      return sendError(response, 400, err.message, false);
    }

    const { id } = body;
    if (!id) {
      return sendError(response, 400, 'Required field: id', false);
    }

    const idNum = Number(id);
    if (Number.isNaN(idNum)) {
      return sendError(response, 400, 'id must be a number', false);
    }

    const match = pokemonList.find((p) => Number(p.id) === idNum);
    if (!match) {
      return sendError(response, 404, `No pokemon found with id=${idNum}`, false);
    }

    if (body.name) {
      match.name = String(body.name);
    }

    if (body.type) {
      const typeArr = Array.isArray(body.type) ? body.type : String(body.type).split(',');
      match.type = typeArr.map((t) => String(t).trim()).filter(Boolean);
    }

    if (body.weaknesses) {
      const weakArr = Array.isArray(body.weaknesses)
        ? body.weaknesses
        : String(body.weaknesses).split(',');
      match.weaknesses = weakArr.map((w) => String(w).trim()).filter(Boolean);
    }

    // Use 204 
    return sendNoContent(response, 204);
  });
};

const notFound = (request, response, headOnly) =>
  sendJSON(response, 404, { error: 'The page you are looking for was not found.' }, headOnly);

module.exports = {
  init,
  getPokemon,
  getPokemonById,
  getPokemonByNum,
  getTypes,
  addPokemon,
  editPokemon,
  notFound,
};
