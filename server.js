const Hanami = require('./websockets.js');
const app = new Hanami();

// Define uma rota pública e o seu manipulador
app.route('/echo', (ws, data) => {
    ws.send(JSON.stringify({ route: '/echo', data: `Echo: ${data}` }));
});

// Define uma rota pública para broadcast
app.route('/broadcast', (ws, data) => {
    app.broadcast('/broadcast', data);
});

// Define uma rota privada
app.route('/private', async (ws, data, id) => {
    const { targetUsername, message } = data;
    try {
        const targetId = await app.getClientIdByUsername(targetUsername);
        if (targetId) {
            app.sendToClient(targetId, '/private', { from: id, message });
        } else {
            ws.send(JSON.stringify({ route: '/error', data: 'User not found' }));
        }
    } catch (error) {
        ws.send(JSON.stringify({ route: '/error', data: error.message }));
    }
});

// Cria uma rota privada para um usuário específico
app.privateRoute('john_doe', '/private/john', (ws, data) => {
    ws.send(JSON.stringify({ route: '/private/john', data: `Private message to John: ${data}` }));
});

// Inicia o servidor WebSocket
app.listen(process.env.PORT, () => {
    console.log(`WebSocket server is running on ws://localhost:${process.env.PORT}`);
});