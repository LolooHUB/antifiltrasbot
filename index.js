const { 
    Client, 
    Collection, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle, 
    ChannelType, 
    PermissionFlagsBits, 
    ActivityType 
} = require('discord.js');
const { db } = require('./firebase');
const fs = require('node:fs');

const client = new Client({ intents: [3276799] });
client.configGlobal = { webEnabled: 1, ticketsEnabled: 1, bansEnabled: 1, configEnabled: 1 };

// --- CONFIGURACIÓN DE IDs ---
const ROL_TICKETS = '1433603806003990560';
const ROL_STAFF_PING = '1433602018957594717';
const CANAL_TICKETS_ID = '1433599187324502016';
const CANAL_BUGS_ID = '1471992338057527437';
const CANAL_STATUS_WEB = '1471651769565315072';

let lastPingTimestamp = null;
let isFirstLoad = true;

client.once('ready', async () => {
    console.log(`✅ Anti-Filtras Pro Online: ${client.user.tag}`);
    client.user.setActivity('ᴀɴᴛɪ-ꜰɪʟᴛʀᴀꜱ ᴄᴏᴍᴍᴜɴɪᴛʏ', { type: ActivityType.Watching });

    // --- MONITOR DE FIREBASE Y BLOQUEO DINÁMICO ---
    db.collection('BOT_CONTROL').doc('settings').onSnapshot(async (doc) => {
        const data = doc.data();
        if (!data) return;

        const guild = client.guilds.cache.first();
        if (data.ticketsEnabled === 0 && client.configGlobal.ticketsEnabled !== 0) {
            const openTickets = guild.channels.cache.filter(c => (c.name.startsWith('🎫-') || c.name.startsWith('🐛-')) && c.type === ChannelType.GuildText);
            for (const [id, chan] of openTickets) {
                await chan.permissionOverwrites.edit(ROL_TICKETS, { SendMessages: false }).catch(() => null);
                chan.permissionOverwrites.cache.forEach(async (ov) => {
                    if (ov.id !== ROL_TICKETS && ov.id !== client.user.id && ov.id !== guild.id) {
                        await chan.permissionOverwrites.edit(ov.id, { SendMessages: false }).catch(() => null);
                    }
                });
                const pauseEmb = new EmbedBuilder()
                    .setTitle("⚠️ SISTEMA EN PAUSA")
                    .setDescription(`\u200B\n> **ᴀɴᴛɪ-ꜰɪʟᴛʀᴀꜱ ᴄᴏᴍᴍᴜɴɪᴛʏ**\n\nEl sistema de soporte se encuentra en mantenimiento. El chat ha sido **bloqueado**. Volveremos a la normalidad en breve.\n\u200B`)
                    .setColor(0xff3e3e);
                await chan.send({ embeds: [pauseEmb] }).catch(() => null);
            }
        } else if (data.ticketsEnabled === 1 && client.configGlobal.ticketsEnabled === 0) {
            const openTickets = guild.channels.cache.filter(c => (c.name.startsWith('🎫-') || c.name.startsWith('🐛-')) && c.type === ChannelType.GuildText);
            for (const [id, chan] of openTickets) {
                await chan.permissionOverwrites.edit(ROL_TICKETS, { SendMessages: true }).catch(() => null);
                chan.permissionOverwrites.cache.forEach(async (ov) => {
                    if (ov.id !== ROL_TICKETS && ov.id !== client.user.id && ov.id !== guild.id) {
                        await chan.permissionOverwrites.edit(ov.id, { SendMessages: true }).catch(() => null);
                    }
                });
                await chan.send({ content: "✅ **Sistema restablecido.** Ya pueden continuar." }).catch(() => null);
            }
        }

        client.configGlobal = data;

        // --- MONITOR DE STATUS (CANAL STATUS) ---
        const statusChannel = await client.channels.fetch(CANAL_STATUS_WEB).catch(() => null);
        if (statusChannel) {
            const getStatus = (v) => v === 1 ? "🟢 ` OPERATIVO `" : (v === 2 ? "🟡 ` MANTENIMIENTO `" : "🔴 ` DESACTIVADO `");
            const statusEmbed = new EmbedBuilder()
                .setAuthor({ name: "MONITOR DE SISTEMAS GLOBAL", iconURL: client.user.displayAvatarURL() })
                .setDescription(`### Estado de Infraestructura :\n\n🌐 **WEB:** ${getStatus(data.webEnabled)}\n📩 **TICKETS:** ${getStatus(data.ticketsEnabled)}\n⚙️ **CONFIG:** ${getStatus(data.configEnabled)}\n🚫 **BANS:** ${getStatus(data.bansEnabled)}\n\n\u200B`)
                .setColor(data.webEnabled === 1 ? 0x2b2d31 : 0xff3e3e).setTimestamp();
            
            const msgs = await statusChannel.messages.fetch({ limit: 10 });
            const botMsg = msgs.filter(m => m.author.id === client.user.id).first();
            if (botMsg) await botMsg.edit({ embeds: [statusEmbed] }); else await statusChannel.send({ embeds: [statusEmbed] });
        }
    });

    // --- SETUP DE PANELES (CANAL TICKETS/BUGS) ---
    const setupPanel = async (cid, title, desc, bid, bl, em) => {
        const chan = client.channels.cache.get(cid); if (!chan) return;
        const ms = await chan.messages.fetch({ limit: 10 });
        await chan.bulkDelete(ms.filter(m => m.author.id === client.user.id)).catch(() => null);
        const emb = new EmbedBuilder()
            .setAuthor({ name: "ᴀɴᴛɪ-ꜰɪʟᴛʀᴀꜱ ᴄᴏᴍᴍᴜɴɪᴛʏ", iconURL: client.user.displayAvatarURL() })
            .setTitle(title).setDescription(`\u200B\n${desc}\n\u200B`).setColor(0x2b2d31)
            .setFooter({ text: "Seguridad y Regulación Global", iconURL: "https://i.imgur.com/vHq4MOn.png" });
        const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(bid).setLabel(bl).setStyle(ButtonStyle.Secondary).setEmoji(em));
        await chan.send({ embeds: [emb], components: [row] });
    };

    await setupPanel(CANAL_TICKETS_ID, "🛡️ REPORTE DE FILTRACIÓN", "### ¿Deseas reportar a un Filtra?\nPresiona el botón para abrir un expediente. Asegúrate de tener las pruebas listas.", "btn_ticket", "Abrir Reporte", "🛡️");
    await setupPanel(CANAL_BUGS_ID, "⚙️ REPORTE DE ERRORES", "### ¿Encontraste un fallo?\nReporta cualquier error técnico en el bot o la plataforma web.", "btn_bug", "Enviar Bug", "⚙️");
});

client.on('interactionCreate', async i => {
    if (i.isButton()) {
        if (i.customId === 'close_ticket') return i.channel.delete();
        if (client.configGlobal.ticketsEnabled === 0) return i.reply({ content: "❌ Sistema apagado.", ephemeral: true });

        const modal = new ModalBuilder().setCustomId(i.customId === 'btn_ticket' ? 'mdl_reporte' : 'mdl_bug').setTitle(i.customId === 'btn_ticket' ? 'Formulario de Reporte' : 'Reportar Bug');
        
        if (i.customId === 'btn_ticket') {
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('u').setLabel('ID del Infractor').setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('e').setLabel('Pruebas (Links)').setStyle(TextInputStyle.Paragraph).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('o').setLabel('Información Adicional').setStyle(TextInputStyle.Paragraph).setRequired(false))
            );
        } else {
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('bt').setLabel('Sistema Afectado').setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('bd').setLabel('Descripción del Fallo').setStyle(TextInputStyle.Paragraph).setRequired(true))
            );
        }
        await i.showModal(modal);
    }

    if (i.isModalSubmit()) {
        const isBug = i.customId === 'mdl_bug';
        const ch = await i.guild.channels.create({
            name: `${isBug ? '🐛-bug' : '🎫-reporte'}-${i.user.username}`,
            type: ChannelType.GuildText,
            permissionOverwrites: [
                { id: i.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                { id: i.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
                { id: ROL_TICKETS, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
            ]
        });

        // 1. EMBED DE BIENVENIDA (MODERNO)
        const welcomeEmb = new EmbedBuilder()
            .setTitle(`BIENVENIDO AL SOPORTE`)
            .setDescription(
                `Hola <@${i.user.id}>, gracias por contactar con **ᴀɴᴛɪ-ꜰɪʟᴛʀᴀꜱ ᴄᴏᴍᴍᴜɴɪᴛʏ**.\n\n` +
                `### 📌 Instrucciones:\n` +
                `> Por favor, bríndanos **capturas de pantalla, videos o archivos** adicionales que refuercen tu reporte.\n\n` +
                `Un miembro de nuestro equipo <@&${ROL_TICKETS}> revisará la información en breve. Mantente atento a este canal.`
            )
            .setColor(0x2b2d31)
            .setThumbnail(i.user.displayAvatarURL());

        // 2. EMBED DE INFORMACIÓN TÉCNICA (MODERNO)
        const infoEmb = new EmbedBuilder()
            .setAuthor({ name: `REMITENTE: ${i.user.tag.toUpperCase()}`, iconURL: i.user.displayAvatarURL() })
            .setTitle(isBug ? "🛠️ DATOS DEL INFORME TÉCNICO" : "📂 EXPEDIENTE DE SEGURIDAD")
            .setColor(isBug ? 0xFFAA00 : 0x2b2d31)
            .setDescription(`\u200B\n**Sincronización de Base de Datos:**\n> *Estado: Pendiente de Revisión*\n\u200B`);

        if (isBug) {
            infoEmb.addFields(
                { name: "💻 SISTEMA", value: `\`\`\`${i.fields.getTextInputValue('bt')}\`\`\``, inline: true },
                { name: "🔍 ESTADO", value: `\`🟠 Bug Report\``, inline: true },
                { name: "📖 DESCRIPCIÓN", value: i.fields.getTextInputValue('bd') }
            );
        } else {
            infoEmb.addFields(
                { name: "👤 INFRACTOR (ID)", value: `\`\`\`${i.fields.getTextInputValue('u')}\`\`\``, inline: true },
                { name: "⚖️ CATEGORÍA", value: `\`🛡️ Filtra\``, inline: true },
                { name: "🔗 PRUEBAS", value: i.fields.getTextInputValue('e') },
                { name: "📝 DETALLES", value: `\`\`\`${i.fields.getTextInputValue('o') || 'No se proporcionaron detalles adicionales.'}\`\`\`` }
            );
        }

        infoEmb.setFooter({ text: "ᴀɴᴛɪ-ꜰɪʟᴛʀᴀꜱ • Gestión Interna", iconURL: client.user.displayAvatarURL() }).setTimestamp();

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('close_ticket').setLabel('Cerrar Ticket').setStyle(ButtonStyle.Danger).setEmoji('🔒')
        );

        await ch.send({ content: `<@${i.user.id}> | <@&${ROL_TICKETS}>`, embeds: [welcomeEmb, infoEmb], components: [row] });
        await i.reply({ content: `✅ **Ticket abierto correctamente:** ${ch}`, ephemeral: true });
    }
});

client.login("TOKEN_AQUÍ");
