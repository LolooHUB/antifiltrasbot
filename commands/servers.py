client.on(Events.MessageCreate, async (message) => {
    // Prefijo !
    if (!message.content.startsWith('!') || message.author.bot) return;

    const args = message.content.slice(1).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    if (command === 'servers') {
        // BLINDAJE: Solo tú o los Staff Globales definidos antes pueden ver esto
        const STAFF_ROLES = ['1433601009284026540', '1400715562568519781', '1433608596871970967', '1400711250878529556'];
        if (!STAFF_ROLES.some(id => message.member.roles.cache.has(id)) && message.author.id !== message.guild.ownerId) {
            return message.reply("❌ No tienes permisos para ver la red de servidores.");
        }

        const logo = new AttachmentBuilder('./logo.webp');
        const guilds = client.guilds.cache;
        
        // Mapear la lista de servidores
        const lista = guilds.map(g => `• **${g.name}** \`(${g.id})\` - 👥 ${g.memberCount}`).join('\n');

        const embed = new EmbedBuilder()
            .setAuthor({ name: "RED DE SEGURIDAD ANTI-FILTRAS", iconURL: 'attachment://logo.webp' })
            .setTitle(`Conectado actualmente a ${guilds.size} servidores`)
            .setDescription(lista.length > 2048 ? lista.substring(0, 2045) + "..." : lista)
            .setThumbnail('attachment://logo.webp')
            .setColor("#2b2d31")
            .setFooter({ text: "Sistema de Monitoreo Global" })
            .setTimestamp();

        await message.reply({ embeds: [embed], files: [logo] });
    }
});
