const { Client, GatewayIntentBits, Collection, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, ChannelType, PermissionFlagsBits, ActivityType } = require('discord.js');
const { db } = require('./firebase');
const fs = require('node:fs');

const client = new Client({ intents: [3276799] });
client.commands = new Collection();
client.configGlobal = { ticketsEnabled: true, bansEnabled: true, configEnabled: true };

const ROL_TICKETS = '1433603806003990560';
const CANAL_TICKETS_ID = '1433599187324502016';
const CANAL_STATUS_WEB = '1471651769565315072';

// Carga de Comandos
const commandFiles = fs.readdirSync('./commands').filter(f => f.endsWith('.js'));
for (const file of commandFiles) {
  const cmd = require(`./commands/${file}`);
  client.commands.set(cmd.data.name, cmd);
}

client.once('ready', async () => {
  console.log(`Bot Online: ${client.user.tag}`);
  
  // Status solicitado
  client.user.setActivity('Viendo reportes', { type: ActivityType.Watching });

  // LISTENER DE FIREBASE (WEB CONTROL)
  db.collection('BOT_CONTROL').doc('settings').onSnapshot(async (doc) => {
    const data = doc.data();
    if (!data) return;
    client.configGlobal = data;

    const statusChannel = await client.channels.fetch(CANAL_STATUS_WEB).catch(() => null);
    if (statusChannel) {
      const embed = new EmbedBuilder()
        .setTitle("🛠️ Cambio en Panel de Control Web")
        .addFields(
          { name: "Tickets", value: data.ticketsEnabled ? "✅" : "❌", inline: true },
          { name: "Baneos", value: data.bansEnabled ? "✅" : "❌", inline: true },
          { name: "Config Servers", value: data.configEnabled ? "✅" : "❌", inline: true }
        )
        .setColor(data.ticketsEnabled ? "Green" : "Red").setTimestamp();
      statusChannel.send({ embeds: [embed] });
    }
  });

  // Panel de Tickets
  const channel = client.channels.cache.get(CANAL_TICKETS_ID);
  if (channel) {
    const messages = await channel.messages.fetch({ limit: 50 });
    const botMsgs = messages.filter(m => m.author.id === client.user.id);
    if (botMsgs.size > 0) await channel.bulkDelete(botMsgs).catch(() => null);

    const embed = new EmbedBuilder().setTitle("📩 Tickets de Reporte").setDescription("Presiona para reportar un filtra.").setColor("Red");
    const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('btn_ticket').setLabel('Reportar').setStyle(ButtonStyle.Danger));
    await channel.send({ embeds: [embed], components: [row] });
  }
});

client.on('interactionCreate', async i => {
  if (i.isChatInputCommand()) {
    const cmd = client.commands.get(i.commandName);
    if (cmd) await cmd.execute(i);
  }

  if (i.isButton() && i.customId === 'btn_ticket') {
    if (!client.configGlobal.ticketsEnabled) return i.reply({ content: "❌ Sistema desactivado por la administración.", ephemeral: true });
    
    const modal = new ModalBuilder().setCustomId('mdl_reporte').setTitle('Reporte');
    modal.addComponents(
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('u').setLabel('Usuario').setStyle(1).setRequired(true)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('e').setLabel('Evidencia').setStyle(2).setRequired(true)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('o').setLabel('Extra').setStyle(2).setRequired(false))
    );
    await i.showModal(modal);
  }

  if (i.isModalSubmit() && i.customId === 'mdl_reporte') {
    const u = i.fields.getTextInputValue('u'), e = i.fields.getTextInputValue('e'), o = i.fields.getTextInputValue('o') || 'N/A';
    const ch = await i.guild.channels.create({
      name: `reporte-${i.user.username}`,
      permissionOverwrites: [
        { id: i.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
        { id: i.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles] },
        { id: ROL_TICKETS, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
      ]
    });
    const emb = new EmbedBuilder().setTitle("Nuevo Reporte").addFields({name:"User",value:u},{name:"Ev",value:e},{name:"Extra",value:o}).setColor("Blue");
    await ch.send({ content: `<@${i.user.id}> <@&${ROL_TICKETS}>`, embeds: [emb] });
    await i.reply({ content: `Ticket: ${ch}`, ephemeral: true });
  }
});

client.login(process.env.DISCORD_TOKEN);
