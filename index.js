import { 
  Client, 
  GatewayIntentBits, 
  EmbedBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  ActionRowBuilder, 
  Collection 
} from "discord.js";
import fs from "fs";
import path from "path";
import app from "./firebase.js";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds, 
    GatewayIntentBits.GuildMessages, 
    GatewayIntentBits.MessageContent
  ],
});

client.commands = new Collection();

// 🔹 CONFIG
const SERVER_ID = "1400709679398654043";
const REPORT_CHANNEL_ID = "1412420238284423208";
const STAFF_ROLE_ID = "PONER_ID_DEL_ROL_STAFF_AQUI"; // <-- CAMBIA ESTO

// 🔹 CARGAR COMANDOS AUTOMÁTICAMENTE
const commandsPath = path.join(process.cwd(), "comandos");
for (const file of fs.readdirSync(commandsPath)) {
  if (file.endsWith(".js")) {
    import(`./comandos/${file}`).then((cmd) => {
      if (cmd.default?.data?.name) {
        client.commands.set(cmd.default.data.name, cmd.default);
        console.log(`✅ Comando cargado: ${cmd.default.data.name}`);
      }
    }).catch(console.error);
  }
}

// 🔹 MANEJAR COMANDOS
client.on("interactionCreate", async (interaction) => {
  if (interaction.isChatInputCommand()) {
    const command = client.commands.get(interaction.commandName);
    if (!command) return;
    try {
      await command.execute(interaction);
    } catch (err) {
      console.error(err);
      if (!interaction.replied) {
        await interaction.reply({ content: "❌ Hubo un error ejecutando el comando.", ephemeral: true });
      }
    }
  }

  // 🔹 BOTÓN DE CREAR TICKET
  if (interaction.isButton() && interaction.customId === "crear_ticket") {
    const guild = interaction.guild;
    if (!guild) return;

    const existingChannel = guild.channels.cache.find(c => c.name === `ticket-${interaction.user.id}`);
    if (existingChannel) {
      return interaction.reply({ content: "❌ Ya tienes un ticket abierto.", ephemeral: true });
    }

    const overwrites = [
      { id: guild.roles.everyone.id, deny: ["ViewChannel"] },
      { id: interaction.user.id, allow: ["ViewChannel", "SendMessages", "ReadMessageHistory"] }
    ];

    if (STAFF_ROLE_ID && guild.roles.cache.has(STAFF_ROLE_ID)) {
      overwrites.push({ id: STAFF_ROLE_ID, allow: ["ViewChannel", "SendMessages", "ReadMessageHistory"] });
    }

    const ticketChannel = await guild.channels.create({
      name: `ticket-${interaction.user.id}`,
      type: 0, // Canal de texto
      permissionOverwrites: overwrites
    });

    const ticketEmbed = new EmbedBuilder()
      .setTitle("📨 Nuevo ticket creado")
      .setDescription(`Ticket de ${interaction.user.tag}\nUsá este canal para detallar tu reporte.`)
      .setColor("Blurple");

    await ticketChannel.send({ 
      content: `<@${interaction.user.id}>`, 
      embeds: [ticketEmbed] 
    });

    // 🔹 Importante: usar followUp después de crear el canal
    return interaction.reply({ 
      content: `✅ Ticket creado correctamente: ${ticketChannel}`, 
      ephemeral: true 
    });
  }
});

// 🔹 AL INICIAR
client.once("ready", async () => {
  console.log(`✅ AntiFiltras Bot conectado como ${client.user.tag}`);

  const channel = client.channels.cache.get(REPORT_CHANNEL_ID);
  if (channel) {
    const embed = new EmbedBuilder()
      .setTitle("📢 Reportar usuario")
      .setDescription("Presiona el botón para crear un ticket de reporte con el staff.")
      .setColor("Blurple");

    const boton = new ButtonBuilder()
      .setCustomId("crear_ticket")
      .setLabel("🎫 Crear ticket")
      .setStyle(ButtonStyle.Primary);

    const fila = new ActionRowBuilder().addComponents(boton);

    await channel.send({ embeds: [embed], components: [fila] });
  }
});

// 🔹 LOGIN
client.login(process.env.BOT_TOKEN);
