import { 
  Client, 
  GatewayIntentBits, 
  Partials, 
  Collection, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle 
} from "discord.js";
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

// -------------------- IDS --------------------
const SERVER_ID = "1400709679398654043";
const REPORT_CHANNEL_ID = "1412420238284423208";
const GLOBAL_BANS_CHANNEL_ID = "1412415386971799693";
const LOGS_CHANNEL_ID = "1433599445114814555";
const COMMAND_CHANNEL_ID = "1433600237024448642";
const STAFF_ROLE_ID = "ID_ROL_STAFF"; // Cambiar por tu rol de staff

// -------------------- CARGA DE COMANDOS --------------------
async function loadCommands() {
  const commandsPath = path.join(process.cwd(), "comandos");
  const commandFiles = fs.readdirSync(commandsPath).filter(f => f.endsWith(".js"));

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
}

// -------------------- INTERACTIONS --------------------
client.on("interactionCreate", async (interaction) => {
  // ----------------- BOTONES -----------------
  if (interaction.isButton()) {
    if (interaction.customId === "crear_ticket") {
  const guild = interaction.guild;
  if (!guild) return;

  const channelName = `ticket-${interaction.user.id}`;
  const existingChannel = guild.channels.cache.find(c => c.name === channelName);
  if (existingChannel) {
    return interaction.reply({ content: "Ya tienes un ticket abierto!", ephemeral: true });
  }

  const overwrites = [
    { id: guild.roles.everyone.id, deny: ["ViewChannel"] },
    { id: interaction.user.id, allow: ["ViewChannel", "SendMessages", "ReadMessageHistory"] }
  ];

  if (STAFF_ROLE_ID && guild.roles.cache.has(STAFF_ROLE_ID)) {
    overwrites.push({ id: STAFF_ROLE_ID, allow: ["ViewChannel", "SendMessages", "ReadMessageHistory"] });
  }

  const ticketChannel = await guild.channels.create({
    name: channelName,
    type: 0,
    permissionOverwrites: overwrites,
  });

  const ticketEmbed = new EmbedBuilder()
    .setTitle("📨 Nuevo ticket")
    .setDescription(`Ticket creado por ${interaction.user.tag}`)
    .setColor("Blurple")
    .setTimestamp();

  await ticketChannel.send({ content: `<@${interaction.user.id}>`, embeds: [ticketEmbed] });
  return interaction.reply({ content: `✅ Ticket creado: ${ticketChannel}`, ephemeral: true });
}

  }

  // ----------------- SLASH COMMANDS -----------------
  if (!interaction.isChatInputCommand()) return;

  if (interaction.channelId !== COMMAND_CHANNEL_ID) {
    return interaction.reply({ content: "❌ Los comandos solo pueden usarse en el canal autorizado.", ephemeral: true });
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

  await loadCommands();

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
