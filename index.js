import { Client, GatewayIntentBits, EmbedBuilder, Collection, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionsBitField, Partials } from "discord.js";
import fs from "fs";
import path from "path";
import { db } from "./firebase.js";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ],
  partials: [Partials.Channel],
});

client.commands = new Collection();

// IDs fijas
const SERVER_ID = "1400709679398654043";
const REPORT_CHANNEL_ID = "1412420238284423208";
const GLOBAL_BANS_CHANNEL_ID = "1412415386971799693";
const LOGS_CHANNEL_ID = "1433599445114814555";
const COMMAND_CHANNEL_ID = "1433600237024448642";

// -------------------- CARGA DE COMANDOS --------------------
const commandsPath = path.join(process.cwd(), "comandos");
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith(".js"));

for (const file of commandFiles) {
  try {
    const cmd = await import(`./comandos/${file}`);
    if (cmd.default && cmd.default.data && cmd.default.execute) {
      client.commands.set(cmd.default.data.name, cmd.default);
      console.log(`✅ Comando cargado: ${cmd.default.data.name}`);
    } else {
      console.warn(`⚠️ Comando ${file} no tiene data o execute`);
    }
  } catch (err) {
    console.error(`❌ Error cargando comando ${file}:`, err);
  }
}

// -------------------- INTERACTIONS --------------------
client.on("interactionCreate", async (interaction) => {
  if (interaction.isButton()) {
    // BOTÓN de reporte
    if (interaction.customId === "crear_ticket") {
      await interaction.reply({ content: "Ticket creado! ✅", ephemeral: true });
      // Aquí podés crear un canal o manejar el ticket
    }
    return;
  }

  if (!interaction.isChatInputCommand()) return;

  // Restringir canal de comandos
  if (interaction.channelId !== COMMAND_CHANNEL_ID) {
    await interaction.reply({ content: "❌ Los comandos solo pueden usarse en el canal autorizado.", ephemeral: true });
    return;
  }

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction, { db, GLOBAL_BANS_CHANNEL_ID, LOGS_CHANNEL_ID });
  } catch (err) {
    console.error(err);
    await interaction.reply({ content: "❌ Hubo un error al ejecutar este comando.", ephemeral: true });
  }
});

// -------------------- READY --------------------
client.once("ready", async () => {
  console.log(`✅ AntiFiltras Bot conectado como ${client.user.tag}`);

  const reportEmbed = new EmbedBuilder()
    .setTitle("📨 Reportar usuario")
    .setDescription("Presiona el botón de abajo para crear un ticket de reporte.")
    .setColor("Blurple");

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("crear_ticket")
      .setLabel("📩 Crear Ticket")
      .setStyle(ButtonStyle.Primary)
  );

  const channel = client.channels.cache.get(REPORT_CHANNEL_ID);
  if (channel) {
    channel.send({ embeds: [reportEmbed], components: [row] }).catch(console.log);
  }
});

// -------------------- LOGIN --------------------
if (!process.env.BOT_TOKEN) {
  console.error("❌ No se encontró BOT_TOKEN en las variables de entorno.");
  process.exit(1);
}

client.login(process.env.BOT_TOKEN);
