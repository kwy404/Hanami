const WebSocket = require('ws');
const dotenv = require('dotenv');
const sqlite3 = require('sqlite3').verbose();

dotenv.config();

class Hanami {
    constructor() {
        this.port = process.env.PORT || 8080;
        this.wss = null;
        this.routes = {};
        this.clients = new Map();
        this.db = null;

        this.setupDatabase();
    }

    // Configura a conexão com o banco de dados SQLite
    setupDatabase() {
        const dbUrl = process.env.DATABASE_URL;

        this.db = new sqlite3.Database(dbUrl, (err) => {
            if (err) {
                console.error('Error connecting to SQLite:', err.message);
            } else {
                console.log('Connected to SQLite');
                // Cria a tabela de usuários se não existir
                this.db.run(`
                    CREATE TABLE IF NOT EXISTS users (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        username TEXT UNIQUE,
                        client_id INTEGER
                    )
                `);
            }
        });
    }

    // Inicia o servidor WebSocket
    listen(port, callback) {
        this.port = port || this.port;
        this.wss = new WebSocket.Server({ port: this.port });

        this.wss.on('connection', (ws) => {
            const id = Date.now();
            this.clients.set(id, ws);

            ws.on('message', (message) => {
                const { route, data } = JSON.parse(message);
                if (this.routes[route]) {
                    this.routes[route].forEach(handler => handler(ws, data, id));
                } else {
                    console.error(`No route found for ${route}`);
                }
            });

            ws.on('close', () => {
                this.clients.delete(id);
                console.log('Client disconnected');
            });

            ws.on('error', (error) => {
                console.error('WebSocket error:', error);
            });
        });

        if (callback) {
            callback();
        }
    }

    // Define uma rota e seus manipuladores
    route(path, ...handlers) {
        if (!this.routes[path]) {
            this.routes[path] = [];
        }
        this.routes[path].push(...handlers);
    }

    // Envia uma mensagem para todos os clientes conectados
    broadcast(route, data) {
        this.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({ route, data }));
            }
        });
    }

    // Envia uma mensagem para um cliente específico
    sendToClient(id, route, data) {
        const client = this.clients.get(id);
        if (client && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ route, data }));
        }
    }

    // Recupera o client_id de um usuário pelo username
    getClientIdByUsername(username) {
        if (!this.db) {
            return Promise.reject('No database connection');
        }

        return new Promise((resolve, reject) => {
            this.db.get('SELECT client_id FROM users WHERE username = ?', [username], (err, row) => {
                if (err) {
                    console.error('Database query error:', err);
                    reject(err);
                } else {
                    resolve(row?.client_id);
                }
            });
        });
    }

    // Cria uma rota privada para um usuário específico
    privateRoute(username, path, ...handlers) {
        this.getClientIdByUsername(username).then(clientId => {
            if (clientId) {
                this.route(`${path}/${clientId}`, ...handlers);
            } else {
                console.error(`No client found for username: ${username}`);
            }
        }).catch(err => {
            console.error(`Error finding client for username: ${username}`, err);
        });
    }
}

module.exports = Hanami;