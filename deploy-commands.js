const { REST, Routes } = require('discord.js');
const fs = require('node:fs');

const commands = [];
const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const command = require(`./commands/${file}`);
    if ('data' in command && 'execute' in command) {
        commands.push(command.data.toJSON());
    }
}

const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN);

(async () => {
    try {
        console.log(`🚀 Desplegando ${commands.length} comandos...`);
        await rest.put(
            Routes.applicationCommands("1398806163071570090"),
            { body: commands },
        );
        console.log('✅ Comandos registrados.');
    } catch (error) {
        console.error(error);
    }
})();
