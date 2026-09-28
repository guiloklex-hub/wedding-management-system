package br.com.paivalab.weddingmanagementsystem.data

import androidx.room.withTransaction
import java.security.MessageDigest
import org.json.JSONArray
import org.json.JSONObject

object DemoSeed {
    suspend fun populate(database: PlannerDatabase, preferences: PlannerPreferences) {
        val dao = database.dao()
        val now = System.currentTimeMillis()

        preferences.setLocale("pt-BR")
        preferences.setCurrency("BRL")

        val settings = listOf(
            PlannerSetting("coupleNames", "Guilherme & Marina"),
            PlannerSetting("eventDate", "2027-05-15"),
            PlannerSetting("pixKey", "casamento@guilhermeemarina.com.br"),
            PlannerSetting("pixHolderName", "Guilherme S. Paiva"),
            PlannerSetting("pixCity", "ITU"),
            PlannerSetting("contingencyPercent", "10"),
            PlannerSetting(
                "daySchedule",
                "15:30 Recepção dos convidados com quarteto de cordas\n" +
                    "16:15 Cortejo dos padrinhos e pais\n" +
                    "16:30 Cerimônia ao ar livre no jardim principal\n" +
                    "17:30 Coquetel e fotos ao pôr do sol\n" +
                    "19:00 Jantar empratado no salão de cristal\n" +
                    "21:00 Primeira dança e abertura da pista\n" +
                    "02:00 Encerramento e van de retorno",
            ),
            PlannerSetting(
                "rainPlanB",
                "Tenda cristal 20x30m contratada em stand-by com piso tablado no terraço coberto da Fazenda Vila Rica; acionamento até 48h antes sem custo extra.",
            ),
            PlannerSetting(
                "daySpecialNotes",
                "Reservar 2 mesas próximas ao altar para avós com mobilidade reduzida. Menu vegano e celíaco confirmado para Mesa 03.",
            ),
        )

        val records = listOf(
            // Vendors
            PlannerRecord(
                id = "seed-vendor-1",
                kind = Kinds.VENDOR,
                title = "Fazenda Vila Rica Eventos",
                subtitle = "Espaço & Cerimônia",
                status = "CONTRACTED",
                phone = "+5511998881122",
                email = "contato@fazendavilarica.com.br",
                notes = "Espaço exclusivo para 200 convidados com capela e gerador.",
                extraJson = JSONObject().put("rating", 5).toString(),
                createdAt = now - 86_400_000L * 30,
                updatedAt = now - 86_400_000L * 5,
            ),
            PlannerRecord(
                id = "seed-vendor-2",
                kind = Kinds.VENDOR,
                title = "Buffet Alta Gastronomia",
                subtitle = "Buffet & Bar",
                status = "CONTRACTED",
                phone = "+5511997773344",
                email = "eventos@altagastronomia.com.br",
                notes = "Menu franco-italiano completo, ilha gastronômica e open bar premium.",
                extraJson = JSONObject().put("rating", 5).toString(),
                createdAt = now - 86_400_000L * 25,
                updatedAt = now - 86_400_000L * 4,
            ),
            PlannerRecord(
                id = "seed-vendor-3",
                kind = Kinds.VENDOR,
                title = "Ateliê Floral Botânica",
                subtitle = "Decoração & Flores",
                status = "NEGOTIATION",
                phone = "+5511996665566",
                email = "orcamento@floralbotanica.com.br",
                notes = "Projeto floral clássico em tons branco, verde oliva e champagne.",
                extraJson = JSONObject().put("rating", 4).toString(),
                createdAt = now - 86_400_000L * 15,
                updatedAt = now - 86_400_000L * 2,
            ),
            PlannerRecord(
                id = "seed-vendor-4",
                kind = Kinds.VENDOR,
                title = "Studio Luz & Filme 4K",
                subtitle = "Fotografia & Filmagem",
                status = "FINALIZED",
                phone = "+5511995557788",
                email = "agenda@studioluzfilme.com.br",
                notes = "Cobertura com 3 fotógrafos, drone e same-day edit.",
                extraJson = JSONObject().put("rating", 5).toString(),
                createdAt = now - 86_400_000L * 20,
                updatedAt = now - 86_400_000L * 1,
            ),
            // Venues
            PlannerRecord(
                id = "seed-venue-1",
                kind = Kinds.VENUE,
                title = "Fazenda Vila Rica — Jardim & Salão Cristal",
                subtitle = "Itu, SP (Capacidade: 220 convidados)",
                amountCents = 38_000_00L,
                phone = "+5511998881122",
                email = "visitas@fazendavilarica.com.br",
                notes = "Estacionamento interno para 120 carros e suíte da noiva inclusa.",
                extraJson = JSONObject().put("address", "Rod. Dom Gabriel Paulino Bueno Couto, km 92 — Itu/SP").toString(),
            ),
            PlannerRecord(
                id = "seed-venue-2",
                kind = Kinds.VENUE,
                title = "Villa Toscana Eventos",
                subtitle = "Campinas, SP (Opção comparativa)",
                amountCents = 42_500_00L,
                phone = "+5519991112233",
                email = "eventos@villatoscana.com.br",
                notes = "Segunda opção visitada pelo casal.",
                extraJson = JSONObject().put("address", "Estrada Municipal Joaquim Egídio, km 4 — Campinas/SP").toString(),
            ),
            // Venue Checklist
            PlannerRecord(
                id = "seed-venue-check-1",
                kind = Kinds.VENUE_CHECK,
                title = "Gerador 150kVA dedicado testado e incluso",
                status = "DONE",
                parentId = "seed-venue-1",
            ),
            PlannerRecord(
                id = "seed-venue-check-2",
                kind = Kinds.VENUE_CHECK,
                title = "Suíte da noiva climatizada com luz natural",
                status = "DONE",
                parentId = "seed-venue-1",
            ),
            PlannerRecord(
                id = "seed-venue-check-3",
                kind = Kinds.VENUE_CHECK,
                title = "Vistoria técnica de iluminação cênica",
                status = "TODO",
                parentId = "seed-venue-1",
            ),
            // Budgets
            PlannerRecord(
                id = "seed-budget-1",
                kind = Kinds.BUDGET,
                title = "Locação Espaço Fazenda Vila Rica",
                subtitle = "Espaço",
                estimatedCents = 40_000_00L,
                amountCents = 38_000_00L,
                parentId = "seed-vendor-1",
            ),
            PlannerRecord(
                id = "seed-budget-2",
                kind = Kinds.BUDGET,
                title = "Gastronomia & Bar Premium (180 convidados)",
                subtitle = "Buffet",
                estimatedCents = 58_000_00L,
                amountCents = 56_400_00L,
                parentId = "seed-vendor-2",
            ),
            PlannerRecord(
                id = "seed-budget-3",
                kind = Kinds.BUDGET,
                title = "Projeto Floral & Mobiliário",
                subtitle = "Decoração",
                estimatedCents = 28_000_00L,
                amountCents = 29_500_00L,
                parentId = "seed-vendor-3",
            ),
            PlannerRecord(
                id = "seed-budget-4",
                kind = Kinds.BUDGET,
                title = "Fotografia, Drone & Cinema 4K",
                subtitle = "Foto e Vídeo",
                estimatedCents = 18_000_00L,
                amountCents = 17_500_00L,
                parentId = "seed-vendor-4",
            ),
            // Payments
            PlannerRecord(
                id = "seed-payment-1",
                kind = Kinds.PAYMENT,
                title = "Sinal Fazenda Vila Rica (1/2)",
                amountCents = 19_000_00L,
                date = "2026-08-15",
                status = "PAID",
                parentId = "seed-vendor-1",
                extraJson = JSONObject().put("installmentNumber", 1).put("totalInstallments", 2).toString(),
            ),
            PlannerRecord(
                id = "seed-payment-2",
                kind = Kinds.PAYMENT,
                title = "Quitação Fazenda Vila Rica (2/2)",
                amountCents = 19_000_00L,
                date = "2027-01-15",
                status = "PENDING",
                parentId = "seed-vendor-1",
                extraJson = JSONObject().put("installmentNumber", 2).put("totalInstallments", 2)
                    .put("method", "BANK_TRANSFER").put("lateFeePercent", 2.0).put("interestPercentPerMonth", 1.0).toString(),
            ),
            PlannerRecord(
                id = "seed-payment-3",
                kind = Kinds.PAYMENT,
                title = "Entrada Buffet Alta Gastronomia (1/3)",
                amountCents = 18_800_00L,
                date = "2026-09-10",
                status = "PAID",
                parentId = "seed-vendor-2",
                extraJson = JSONObject().put("installmentNumber", 1).put("totalInstallments", 3).put("method", "PIX").toString(),
            ),
            PlannerRecord(
                id = "seed-payment-4",
                kind = Kinds.PAYMENT,
                title = "Parcela Buffet Alta Gastronomia (2/3)",
                amountCents = 18_800_00L,
                date = "2026-12-10",
                status = "PENDING",
                parentId = "seed-vendor-2",
                extraJson = JSONObject().put("installmentNumber", 2).put("totalInstallments", 3)
                    .put("method", "BOLETO").put("lateFeePercent", 2.0).put("interestPercentPerMonth", 1.0).toString(),
            ),
            PlannerRecord(
                id = "seed-payment-5",
                kind = Kinds.PAYMENT,
                title = "Parcela Final Buffet Alta Gastronomia (3/3)",
                amountCents = 18_800_00L,
                date = "2027-04-10",
                status = "PENDING",
                parentId = "seed-vendor-2",
                extraJson = JSONObject().put("installmentNumber", 3).put("totalInstallments", 3)
                    .put("method", "PIX").put("lateFeePercent", 2.0).put("interestPercentPerMonth", 1.0).toString(),
            ),
            PlannerRecord(
                id = "seed-payment-6",
                kind = Kinds.PAYMENT,
                title = "Quitação Studio Luz & Filme 4K",
                amountCents = 17_500_00L,
                date = "2026-09-20",
                status = "PAID",
                parentId = "seed-vendor-4",
                extraJson = JSONObject().put("method", "PIX").toString(),
            ),
            // Income
            PlannerRecord(
                id = "seed-income-1",
                kind = Kinds.INCOME,
                title = "Aporte Mensal do Casal — Setembro",
                subtitle = "Poupança conjunta",
                amountCents = 12_000_00L,
                date = "2026-09-05",
                status = "RECEIVED",
                extraJson = JSONObject().put("frequency", "MONTHLY").put("source", "SALARY").toString(),
            ),
            PlannerRecord(
                id = "seed-income-2",
                kind = Kinds.INCOME,
                title = "Presente Especial dos Pais",
                subtitle = "Contribuição familiar",
                amountCents = 30_000_00L,
                date = "2026-10-15",
                status = "EXPECTED",
                extraJson = JSONObject().put("frequency", "ONE_TIME").put("source", "PARENTS").toString(),
            ),
            // Goals & Assets
            PlannerRecord(
                id = "seed-goal-1",
                kind = Kinds.GOAL,
                title = "Fundo Principal do Casamento",
                subtitle = "Meta 100% quitada até Abril/2027",
                amountCents = 150_000_00L,
                date = "2027-04-01",
            ),
            PlannerRecord(
                id = "seed-goal-2",
                kind = Kinds.GOAL,
                title = "Reserva Lua de Mel na Itália",
                subtitle = "Toscana & Costa Amalfitana",
                amountCents = 45_000_00L,
                date = "2027-05-01",
            ),
            PlannerRecord(
                id = "seed-asset-1",
                kind = Kinds.ASSET,
                title = "Tesouro Selic Casamento 2027",
                subtitle = "Liquidez diária",
                amountCents = 88_500_00L,
                date = "2026-09-25",
                parentId = "seed-goal-1",
            ),
            PlannerRecord(
                id = "seed-asset-2",
                kind = Kinds.ASSET,
                title = "CDB Reserva Lua de Mel (Euro)",
                subtitle = "Banco Itaú Personnalité",
                amountCents = 32_000_00L,
                date = "2026-09-25",
                parentId = "seed-goal-2",
            ),
            // Tasks
            PlannerRecord(
                id = "seed-task-1",
                kind = Kinds.TASK,
                title = "Assinar contrato da Fazenda Vila Rica",
                subtitle = "Jurídico & Pagamento",
                date = "2026-08-15",
                status = "DONE",
                extraJson = JSONObject().put("priority", "HIGH").toString(),
            ),
            PlannerRecord(
                id = "seed-task-2",
                kind = Kinds.TASK,
                title = "Degustação final do menu com os pais",
                subtitle = "Buffet Alta Gastronomia",
                date = "2026-11-20",
                status = "IN_PROGRESS",
                extraJson = JSONObject().put("priority", "HIGH").toString(),
            ),
            PlannerRecord(
                id = "seed-task-3",
                kind = Kinds.TASK,
                title = "Aprovar layout floral das mesas comunitárias",
                subtitle = "Ateliê Floral Botânica",
                date = "2026-12-05",
                status = "TODO",
                extraJson = JSONObject().put("priority", "MEDIUM").toString(),
            ),
            PlannerRecord(
                id = "seed-task-4",
                kind = Kinds.TASK,
                title = "Enviar Save the Date digital para convidados de fora",
                subtitle = "Comunicação",
                date = "2026-10-10",
                status = "TODO",
                extraJson = JSONObject().put("priority", "HIGH").toString(),
            ),
            // Groups, Tags, Tables, Guests
            PlannerRecord(
                id = "seed-group-1",
                kind = Kinds.GROUP,
                title = "Família do Noivo",
                subtitle = "Núcleo São Paulo",
                phone = "+5511988880001",
                email = "familia.paiva@email.com",
                status = "CONFIRMED",
            ),
            PlannerRecord(
                id = "seed-group-2",
                kind = Kinds.GROUP,
                title = "Família da Noiva",
                subtitle = "Núcleo Campinas",
                phone = "+5519988880002",
                email = "familia.marina@email.com",
                status = "CONFIRMED",
            ),
            PlannerRecord(
                id = "seed-group-3",
                kind = Kinds.GROUP,
                title = "Padrinhos & Madrinhas",
                subtitle = "Cortejo Principal",
                phone = "+5511988880003",
                email = "padrinhos@email.com",
                status = "CONFIRMED",
            ),
            PlannerRecord(
                id = "seed-tag-1",
                kind = Kinds.TAG,
                title = "Padrinhos",
                subtitle = "Cortejo do altar",
            ),
            PlannerRecord(
                id = "seed-tag-2",
                kind = Kinds.TAG,
                title = "VIP / Família Próxima",
                subtitle = "Prioridade de assentos",
            ),
            PlannerRecord(
                id = "seed-table-1",
                kind = Kinds.TABLE,
                title = "Mesa 01 — Família dos Noivos",
                subtitle = "Em frente ao altar principal",
                amountCents = 10L,
            ),
            PlannerRecord(
                id = "seed-table-2",
                kind = Kinds.TABLE,
                title = "Mesa 02 — Padrinhos & Madrinhas",
                subtitle = "Ao lado da pista de dança",
                amountCents = 10L,
            ),
            PlannerRecord(
                id = "seed-guest-1",
                kind = Kinds.GUEST,
                title = "Carlos Eduardo Paiva",
                subtitle = "Pai do Noivo",
                status = "CONFIRMED",
                guestGroupId = "seed-group-1",
                seatingTableId = "seed-table-1",
                plusOnesAllowed = 1,
                plusOnesConfirmed = 1,
                phone = "+5511988881001",
                email = "carlos.paiva@email.com",
                extraJson = JSONObject()
                    .put("tagIds", JSONArray().put("seed-tag-2"))
                    .put("checkedInAt", now - 3_600_000L)
                    .put("side", "NOIVO")
                    .put("isVIP", true)
                    .put("city", "São Paulo - SP")
                    .toString(),
            ),
            PlannerRecord(
                id = "seed-guest-2",
                kind = Kinds.GUEST,
                title = "Helena Soares Paiva",
                subtitle = "Mãe do Noivo",
                status = "CONFIRMED",
                guestGroupId = "seed-group-1",
                seatingTableId = "seed-table-1",
                plusOnesAllowed = 0,
                plusOnesConfirmed = 0,
                phone = "+5511988881002",
                email = "helena.paiva@email.com",
                extraJson = JSONObject()
                    .put("tagIds", JSONArray().put("seed-tag-2"))
                    .put("side", "NOIVO")
                    .put("isVIP", true)
                    .put("dietary", "Sem lactose")
                    .put("city", "São Paulo - SP")
                    .toString(),
            ),
            PlannerRecord(
                id = "seed-guest-3",
                kind = Kinds.GUEST,
                title = "Lucas Mendes Ferreira",
                subtitle = "Padrinho de Honra",
                status = "CONFIRMED",
                guestGroupId = "seed-group-3",
                seatingTableId = "seed-table-2",
                plusOnesAllowed = 1,
                plusOnesConfirmed = 1,
                phone = "+5511988881003",
                email = "lucas.ferreira@email.com",
                extraJson = JSONObject()
                    .put("tagIds", JSONArray().put("seed-tag-1"))
                    .put("side", "AMBOS")
                    .put("isPadrinho", true)
                    .put("city", "Campinas - SP")
                    .toString(),
            ),
            PlannerRecord(
                id = "seed-guest-4",
                kind = Kinds.GUEST,
                title = "Beatriz Almeida Costa",
                subtitle = "Madrinha",
                status = "INVITED",
                guestGroupId = "seed-group-3",
                seatingTableId = "seed-table-2",
                plusOnesAllowed = 1,
                plusOnesConfirmed = 0,
                phone = "+5511988881004",
                email = "beatriz.costa@email.com",
                extraJson = JSONObject()
                    .put("tagIds", JSONArray().put("seed-tag-1"))
                    .put("side", "NOIVA")
                    .put("isPadrinho", true)
                    .put("dietary", "Vegetariana")
                    .put("city", "Campinas - SP")
                    .toString(),
            ),
            // Gifts
            PlannerRecord(
                id = "seed-gift-1",
                kind = Kinds.GIFT,
                title = "Cota Lua de Mel — Jantar Michelin em Florença",
                subtitle = "Presente de Carlos Eduardo Paiva",
                amountCents = 2_500_00L,
                status = "RECEIVED",
                parentId = "seed-guest-1",
            ),
            PlannerRecord(
                id = "seed-gift-2",
                kind = Kinds.GIFT,
                title = "Cafeteira Espresso Italiana Barista Pro",
                subtitle = "Presente de Lucas Mendes Ferreira",
                amountCents = 4_200_00L,
                status = "THANKED",
                parentId = "seed-guest-3",
            ),
            // Honeymoon & Items
            PlannerRecord(
                id = "seed-honeymoon-1",
                kind = Kinds.HONEYMOON,
                title = "Roteiro Romântico: Toscana, Florença & Costa Amalfitana",
                subtitle = "14 dias na Itália (Maio/2027)",
                amountCents = 45_000_00L,
                date = "2027-05-17",
            ),
            PlannerRecord(
                id = "seed-honeymoon-item-1",
                kind = Kinds.HONEYMOON_ITEM,
                title = "Passagens Aéreas São Paulo ↔ Roma (Executiva)",
                subtitle = "Voo direto",
                amountCents = 18_500_00L,
                date = "2027-05-17",
                status = "PAID",
                parentId = "seed-honeymoon-1",
                extraJson = JSONObject().put("itemKind", "FLIGHT").put("confirmationNumber", "LA-99482BR").toString(),
            ),
            PlannerRecord(
                id = "seed-honeymoon-item-2",
                kind = Kinds.HONEYMOON_ITEM,
                title = "Hotel Boutique Villa Cora — Florença (5 noites)",
                subtitle = "Suíte com vista para os jardins",
                amountCents = 14_200_00L,
                date = "2027-05-18",
                status = "BOOKED",
                parentId = "seed-honeymoon-1",
                extraJson = JSONObject().put("itemKind", "HOTEL").put("confirmationNumber", "VC-7721IT").toString(),
            ),
            // Trousseau
            PlannerRecord(
                id = "seed-trousseau-1",
                kind = Kinds.TROUSSEAU,
                title = "Jogo de Lençol Algodão Egípcio 600 Fios King",
                subtitle = "Quarto Principal",
                estimatedCents = 2_100_00L,
                amountCents = 1_890_00L,
                status = "BOUGHT",
                extraJson = JSONObject().put("room", "Quarto").put("priority", "MUST_HAVE").put("store", "Trousseau Iguatemi").toString(),
            ),
            PlannerRecord(
                id = "seed-trousseau-2",
                kind = Kinds.TROUSSEAU,
                title = "Conjunto de Panelas Inox Fundo Triplo 9 Peças",
                subtitle = "Cozinha Gourmet",
                estimatedCents = 2_600_00L,
                amountCents = 2_450_00L,
                status = "GIFTED",
                extraJson = JSONObject().put("room", "Cozinha").put("priority", "MUST_HAVE").put("store", "Zwilling / Fast Shop").toString(),
            ),
            // Contracts, Contacts, Notes, Invitations, Save the Date
            PlannerRecord(
                id = "seed-contract-1",
                kind = Kinds.CONTRACT,
                title = "Contrato Locação Fazenda Vila Rica #2027-08",
                subtitle = "Assinado digitalmente com firma reconhecida",
                amountCents = 38_000_00L,
                date = "2026-08-15",
                status = "SIGNED",
                parentId = "seed-vendor-1",
            ),
            PlannerRecord(
                id = "seed-contact-1",
                kind = Kinds.CONTACT,
                title = "Mariana Vasconcelos — Gerente de Eventos",
                subtitle = "Fazenda Vila Rica",
                phone = "+5511998881122",
                email = "mariana@fazendavilarica.com.br",
                parentId = "seed-vendor-1",
            ),
            PlannerRecord(
                id = "seed-vendor-note-1",
                kind = Kinds.VENDOR_NOTE,
                title = "Acordo de bonificação: +1h de festa sem taxa extra de salão",
                subtitle = "Negociação fechada em reunião presencial",
                notes = "Confirmado por e-mail pela gerente Mariana em 14/08/2026.",
                parentId = "seed-vendor-1",
            ),
            PlannerRecord(
                id = "seed-invitation-1",
                kind = Kinds.INVITATION,
                title = "Convite Oficial — Guilherme & Marina",
                subtitle = "Enviado via WhatsApp com confirmação individual",
                notes = "Olá {name}! Com muita alegria convidamos você para o nosso casamento em {date}. Confirme sua presença!",
            ),
            PlannerRecord(
                id = "seed-save-the-date-1",
                kind = Kinds.SAVE_THE_DATE,
                title = "Save the Date — 15 de Maio de 2027",
                subtitle = "Fazenda Vila Rica, Itu/SP às 15h30",
                notes = "Reserve esta data especial: 15/05/2027 — Casamento de Guilherme & Marina.",
            ),
        )

        val pdfBytes = "%PDF-1.4\n% Contrato Fazenda Vila Rica #2027-08 - Guilherme & Marina\n%%EOF\n".toByteArray(Charsets.UTF_8)
        val sha256 = MessageDigest.getInstance("SHA-256").digest(pdfBytes).joinToString("") { "%02x".format(it) }
        val file = PlannerFile(
            id = "seed-file-1",
            recordId = "seed-contract-1",
            kind = "ATTACHMENT",
            fileName = "Contrato-Fazenda-Vila-Rica-2027.pdf",
            mimeType = "application/pdf",
            byteSize = pdfBytes.size.toLong(),
            sha256 = sha256,
            createdAt = now - 86_400_000L * 10,
        )

        database.withTransaction {
            dao.saveSettings(settings)
            dao.saveRecords(records)
            dao.saveFile(file)
            dao.saveBlob(PlannerBlob(file.id, pdfBytes))
            dao.addAudit(
                PlannerAudit(
                    id = "seed-audit-1",
                    recordId = "seed-vendor-1",
                    action = "SEED_DEMO",
                    at = now,
                    details = "Dados completos de demonstração carregados (${records.size} registros)",
                ),
            )
        }
    }
}
