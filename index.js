import {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Collection,
} from "discord.js";
import fs from "fs";
import path from "path";
import app from "./firebase.js"; // conexión Firebase (ya corregida en tu archivo firebase.js)

// --- CONFIGURACIONES --- //
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

client.commands = new Collection();

// IDs del servidor y canales
const SERVER_ID = "1400709679398654043";
const REPORT_CHANNEL_ID = "1412420238284423208";
const GLOBAL_BANS_CHANNEL_ID = "1412415386971799693";
const LOGS_CHANNEL_ID = "1433599445114814555";
const COMMAND_CHANNEL_ID = "1433600237024448642";

// ID del rol del staff (⚠️ CAMBIA ESTO por el rol real de tu servidor)
const STAFF_ROLE_ID = "PONER_AQUI_ID_DEL_ROL_STAFF";

// --- CARGA DE COMANDOS --- //
const commandsPath = path.join(process.cwd(), "comandos");
for (const file of fs.readdirSync(commandsPath)) {
  if (file.endsWith(".js")) {
    import(`./comandos/${file}`).then((cmd) => {
      if (cmd.default?.data?.name) {
        client.commands.set(cmd.default.data.name, cmd.default);
        console.log(`✅ Comando cargado: ${cmd.default.data.name}`);
      }
    });
  }
}

// --- EVENTO DE INTERACCIÓN --- //
client.on("interactionCreate", async (interaction) => {
  // --- BOTONES --- //
  if (interaction.isButton()) {
    if (interaction.customId === "crear_ticket") {
      const guild = interaction.guild;
      if (!guild) return;

      const channelName = `ticket-${interaction.user.id}`;
      const existingChannel = guild.channels.cache.find(c => c.name === channelName);

      if (existingChannel) {
        return interaction.reply({ content: "⚠️ Ya tienes un ticket abierto.", ephemeral: true });
      }

      const overwrites = [
        { id: guild.roles.everyone.id, deny: ["ViewChannel"] },
        { id: interaction.user.id, allow: ["ViewChannel", "SendMessages", "ReadMessageHistory"] }
      ];

      // Agregar staff solo si existe y el ID es válido
      if (STAFF_ROLE_ID && guild.roles.cache.has(STAFF_ROLE_ID)) {
        overwrites.push({
          id: STAFF_ROLE_ID,
          allow: ["ViewChannel", "SendMessages", "ReadMessageHistory"],
        });
      }

      const ticketChannel = await guild.channels.create({
        name: channelName,
        type: 0,
        permissionOverwrites: overwrites,
      });

      const ticketEmbed = new EmbedBuilder()
        .setTitle("🎫 Nuevo ticket de reporte")
        .setDescription(`Ticket creado por **${interaction.user.tag}**`)
        .setColor("Blurple")
        .setTimestamp();

      await ticketChannel.send({ content: `<@${interaction.user.id}>`, embeds: [ticketEmbed] });
      return interaction.reply({ content: `✅ Ticket creado: ${ticketChannel}`, ephemeral: true });
    }
  }

  // --- COMANDOS SLASH --- //
  if (!interaction.isChatInputCommand()) return;

  if (interaction.channelId !== COMMAND_CHANNEL_ID) {
    await interaction.reply({
      content: "❌ Los comandos solo pueden usarse en el canal autorizado.",
      ephemeral: true,
    });
    return;
  }

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction, { GLOBAL_BANS_CHANNEL_ID, LOGS_CHANNEL_ID });
  } catch (err) {
    console.error(err);
    await interaction.reply({ content: "❌ Hubo un error al ejecutar este comando.", ephemeral: true });
  }
});

// --- EVENTO READY --- //
client.once("ready", async () => {
  console.log(`✅ AntiFiltras Bot conectado como ${client.user.tag}`);

  const reportChannel = await client.channels.fetch(REPORT_CHANNEL_ID).catch(() => null);
  if (reportChannel) {
    const reportEmbed = new EmbedBuilder()
      .setTitle("📨 Reportar usuario")
      .setDescription("Haz clic en el botón de abajo para crear un ticket de reporte.")
      .setColor("Blurple");

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("crear_ticket")
        .setLabel("🎟️ Crear Ticket")
        .setStyle(ButtonStyle.Primary)
    );

    await reportChannel.send({ embeds: [reportEmbed], components: [row] }).catch(() => {});
  } else {
    console.log("⚠️ No se encontró el canal de reportes.");
  }
});

// --- LOGIN --- //
client.login(process.env.BOT_TOKEN);
