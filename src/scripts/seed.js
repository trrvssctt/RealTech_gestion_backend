import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../utils/hash.js';
import { generateCode, generateSequentialNumber } from '../utils/codeGenenrator.js';
import { logger } from '../utils/logger.js';

const prisma = new PrismaClient();

async function seed() {
  try {
    logger.info('🌱 Starting database seed...');

    // Create admin user
    const adminPassword = await hashPassword('Admin123!');
    const admin = await prisma.utilisateur.upsert({
      where: { email: 'admin@realtech.com' },
      update: {},
      create: {
        nom: 'Admin',
        prenom: 'System',
        email: 'admin@realtech.com',
        telephone: '+33123456789',
        password: adminPassword,
        role: 'ADMIN',
      },
    });

    // Create manager user
    const managerPassword = await hashPassword('Manager123!');
    const manager = await prisma.utilisateur.upsert({
      where: { email: 'manager@realtech.com' },
      update: {},
      create: {
        nom: 'Dupont',
        prenom: 'Marie',
        email: 'manager@realtech.com',
        telephone: '+33123456790',
        password: managerPassword,
        role: 'MANAGER',
      },
    });

    // Create employee user
    const employeePassword = await hashPassword('Employee123!');
    const employee = await prisma.utilisateur.upsert({
      where: { email: 'employee@realtech.com' },
      update: {},
      create: {
        nom: 'Martin',
        prenom: 'Pierre',
        email: 'employee@realtech.com',
        telephone: '+33123456791',
        password: employeePassword,
        role: 'EMPLOYE',
      },
    });

    logger.info('✅ Users created');

    // Create sample clients
    const clients = await prisma.client.createMany({
      data: [
        {
          nom: 'Leroy',
          prenom: 'Jean',
          email: 'jean.leroy@email.com',
          telephone: '+33123456792',
        },
        {
          nom: 'Bernard',
          prenom: 'Sophie',
          email: 'sophie.bernard@email.com',
          telephone: '+33123456793',
        },
        {
          nom: 'Moreau',
          prenom: 'Thomas',
          email: 'thomas.moreau@email.com',
          telephone: '+33123456794',
        },
      ],
    });

    logger.info('✅ Clients created');

    // Create sample products
    const products = await prisma.produit.createMany({
      data: [
        {
          nom: 'Ordinateur Portable ASUS',
          description: 'Ordinateur portable 15.6" Intel Core i7, 16GB RAM, 512GB SSD',
          prix_unitaire: 899.99,
          stock_actuel: 15,
        },
        {
          nom: 'Clavier Mécanique Gaming',
          description: 'Clavier mécanique RGB avec switches Cherry MX Blue',
          prix_unitaire: 129.99,
          stock_actuel: 25,
        },
        {
          nom: 'Souris Gaming RGB',
          description: 'Souris gaming haute précision avec éclairage RGB',
          prix_unitaire: 79.99,
          stock_actuel: 30,
        },
        {
          nom: 'Écran 24" Full HD',
          description: 'Moniteur 24 pouces Full HD IPS, 144Hz',
          prix_unitaire: 199.99,
          stock_actuel: 12,
        },
        {
          nom: 'Casque Audio Sans Fil',
          description: 'Casque Bluetooth avec réduction de bruit active',
          prix_unitaire: 159.99,
          stock_actuel: 8,
        },
      ],
    });

    logger.info('✅ Products created');

    // Create sample services
    const services = await prisma.service.createMany({
      data: [
        {
          nom: 'Installation Windows',
          description: 'Installation complète de Windows avec pilotes et logiciels essentiels',
          prix_unitaire: 59.99,
        },
        {
          nom: 'Nettoyage PC',
          description: 'Nettoyage complet du PC, suppression des virus et optimisation',
          prix_unitaire: 39.99,
        },
        {
          nom: 'Récupération de Données',
          description: 'Récupération de données perdues ou corrompues',
          prix_unitaire: 99.99,
        },
        {
          nom: 'Formation Informatique',
          description: 'Formation personnalisée aux outils informatiques (1h)',
          prix_unitaire: 49.99,
        },
        {
          nom: 'Maintenance Préventive',
          description: 'Maintenance préventive complète du matériel informatique',
          prix_unitaire: 79.99,
        },
      ],
    });

    logger.info('✅ Services created');

    // Create sample tasks
    const tasks = await prisma.tache.createMany({
      data: [
        {
          nom: 'Vérification stocks',
          description: 'Vérifier les niveaux de stock des produits populaires',
          date_debut: new Date(),
          date_fin: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
          frequence: 'HEBDOMADAIRE',
          importance: 'HAUTE',
          assigneId: employee.id,
        },
        {
          nom: 'Mise à jour catalogue',
          description: 'Mettre à jour le catalogue produits avec les nouvelles références',
          date_debut: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // Day after tomorrow
          frequence: 'MENSUELLE',
          importance: 'MOYENNE',
          assigneId: manager.id,
        },
        {
          nom: 'Formation équipe',
          description: 'Organiser formation sur les nouveaux produits',
          date_debut: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Next week
          frequence: 'TRIMESTRIELLE',
          importance: 'HAUTE',
          assigneId: admin.id,
        },
      ],
    });

    logger.info('✅ Tasks created');

    // Get created clients for sample orders
    const clientList = await prisma.client.findMany({ take: 3 });
    const productList = await prisma.produit.findMany({ take: 3 });
    const serviceList = await prisma.service.findMany({ take: 2 });

    // Create sample orders
    for (let i = 0; i < 3; i++) {
      const code = generateCode('CMD');
      const numero = generateSequentialNumber('C', i);
      const client = clientList[i];
      const product = productList[i];
      const service = serviceList[i % 2];

      const totalCmd = product.prix_unitaire * 1 + service.prix_unitaire * 1;

      await prisma.commande.create({
        data: {
          code,
          numero,
          total_cmd: totalCmd,
          clientId: client.id,
          createurId: admin.id,
          statut: i === 0 ? 'EN_PREPARATION' : i === 1 ? 'CONFIRMEE' : 'LIVREE',
          commandeProduits: {
            create: {
              produitId: product.id,
              quantite: 1,
              prix_total: product.prix_unitaire,
            },
          },
          commandeServices: {
            create: {
              serviceId: service.id,
              quantite: 1,
              prix_total: service.prix_unitaire,
            },
          },
        },
      });

      // Update product stock
      await prisma.produit.update({
        where: { id: product.id },
        data: { stock_actuel: { decrement: 1 } },
      });
    }

    logger.info('✅ Sample orders created');

    logger.info('🎉 Database seed completed successfully!');
    logger.info('');
    logger.info('📋 Sample users created:');
    logger.info('  👑 Admin: admin@realtech.com / Admin123!');
    logger.info('  👨‍💼 Manager: manager@realtech.com / Manager123!');
    logger.info('  👨‍💻 Employee: employee@realtech.com / Employee123!');
    logger.info('');
    logger.info('📊 Sample data created:');
    logger.info('  - 3 Clients');
    logger.info('  - 5 Products');
    logger.info('  - 5 Services');
    logger.info('  - 3 Tasks');
    logger.info('  - 3 Sample Orders');

  } catch (error) {
    logger.error('❌ Seed failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});