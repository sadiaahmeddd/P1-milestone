const http = require('http');
const fs = require('fs');
const { URL } = require('url');

const api = require('./src/apiResponses.js');

const port = process.env.PORT || process.env.NODE_PORT || 3000;

// Load dataset ONCE at startup (required)
const raw = fs.readFileSync(`${__dirname}/src/pokedex.json`);
const pokedexData = JSON.parse(raw);
api.init(pokedexData);

const isHead = (req) => req.method === 'HEAD';

const onRequest = (request, response) => {
  // Modern URL parsing (no deprecation warning)
  const parsedUrl = new URL(request.url, `http://${request.headers.host}`);
  const pathname = parsedUrl.pathname;
  const query = Object.fromEntries(parsedUrl.searchParams);

  // GET + HEAD endpoints (4+)
  if (request.method === 'GET' || request.method === 'HEAD') {
    switch (pathname) {
      case '/api/pokemon':
        return api.getPokemon(request, response, isHead(request), query);

      case '/api/pokemonById':
        return api.getPokemonById(request, response, isHead(request), query);

      case '/api/pokemonByNum':
        return api.getPokemonByNum(request, response, isHead(request), query);

      case '/api/types':
        return api.getTypes(request, response, isHead(request));

      default:
        return api.notFound(request, response, isHead(request));
    }
  }

  // POST endpoints (2)
  if (request.method === 'POST') {
    switch (pathname) {
      case '/api/addPokemon':
        return api.addPokemon(request, response);

      case '/api/editPokemon':
        return api.editPokemon(request, response);

      default:
        return api.notFound(request, response, false);
    }
  }

  // 
  return api.notFound(request, response, false);
};

http.createServer(onRequest).listen(port);
console.log(`Listening on http://localhost:${port}`);