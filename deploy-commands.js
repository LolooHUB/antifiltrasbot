const { REST, Routes } = require('discord.js');
const fs = require('node:fs');

const commands = [];
const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const command = require(`./commands/${file}`);
    if ('data' in command && 'execute' in command) {
        // Log para depurar qué se está enviando
        console.log(`Checking command: ${file}`); 
        commands.push(command.data.toJSON());
    } else {
        console.log(`[WARNING] El comando en ${file} le falta "data" o "execute".`);
    }
}

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
    try {
        console.log(`🚀 Iniciando actualización de ${commands.length} comandos.`);

        const data = await rest.put(
            Routes.applicationCommands("1398806163071570090"), // Tu Client ID
            { body: commands },
        );

        console.log(`✅ Se registraron ${data.length} comandos exitosamente.`);
    } catch (error) {
        console.error("❌ Error al registrar comandos:");
        console.error(error);
    }
})();
