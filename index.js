import { Client, GatewayIntentBits, EmbedBuilder, Collection, PermissionsBitField } from "discord.js";
import fs from "fs";
import path from "path";
import app from "./firebase.js";

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

client.commands = new Collection();

// IDs fijas según tu configuración
const SERVER_ID = "1400709679398654043";
const REPORT_CHANNEL_ID = "1412420238284423208";
const GLOBAL_BANS_CHANNEL_ID = "1412415386971799693";
const LOGS_CHANNEL_ID = "1433599445114814555";
const COMMAND_CHANNEL_ID = "1433600237024448642";

// Cargar comandos automáticamente
const commandsPath = path.join(process.cwd(), "comandos");
for (const file of fs.readdirSync(commandsPath)) {
  if (file.endsWith(".js")) {
    import(`./comandos/${file}`).then((cmd) => {
      client.commands.set(cmd.default.data.name, cmd.default);
    });
  }
}

// Cuando se ejecuta un comando
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  // Restringir canal de comandos
  if (interaction.channelId !== COMMAND_CHANNEL_ID) {
    await interaction.reply({ content: "❌ Los comandos solo pueden usarse en el canal autorizado.", ephemeral: true });
    return;
  }

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction, { GLOBAL_BANS_CHANNEL_ID, LOGS_CHANNEL_ID });
  } catch (err) {
    console.error(err);
    await interaction.reply({ content: "Hubo un error al ejecutar este comando.", ephemeral: true });
  }
});

// Evento ready
client.once("ready", () => {
  console.log(`✅ AntiFiltras Bot conectado como ${client.user.tag}`);

  const reportEmbed = new EmbedBuilder()
    .setTitle("📨 Reportar usuario")
    .setDescription("Presiona el botón de abajo para crear un ticket de reporte.")
    .setColor("Blurple");

  const channel = client.channels.cache.get(REPORT_CHANNEL_ID);
  if (channel) {
    channel.send({ embeds: [reportEmbed] }).catch(console.log);
  }
});

// Login usando secret del workflow
client.login(process.env.BOT_TOKEN);
