const kkiapay = require('@kkiapay-org/nodejs-sdk');

// Vérifie côté serveur qu'une transaction Kkiapay a bien été payée, avant de
// considérer une réservation ou une commande comme confirmée. La clé privée
// Kkiapay ne doit exister QUE dans les variables d'environnement Netlify
// (Site settings → Environment variables), jamais dans le code du site :
//   KKIAPAY_PRIVATE_KEY, KKIAPAY_PUBLIC_KEY, KKIAPAY_SECRET_KEY
//   KKIAPAY_SANDBOX = "true" en mode test, absent (ou "false") en production
exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ error: 'Méthode non autorisée' }) };
    }

    let transactionId;
    try {
        ({ transactionId } = JSON.parse(event.body || '{}'));
    } catch {
        return { statusCode: 400, body: JSON.stringify({ error: 'Corps de requête JSON invalide' }) };
    }

    if (!transactionId) {
        return { statusCode: 400, body: JSON.stringify({ error: 'transactionId manquant' }) };
    }

    const { KKIAPAY_PRIVATE_KEY, KKIAPAY_PUBLIC_KEY, KKIAPAY_SECRET_KEY, KKIAPAY_SANDBOX } = process.env;
    if (!KKIAPAY_PRIVATE_KEY || !KKIAPAY_PUBLIC_KEY || !KKIAPAY_SECRET_KEY) {
        return { statusCode: 500, body: JSON.stringify({ error: 'Clés Kkiapay non configurées côté serveur (variables d\'environnement Netlify manquantes)' }) };
    }

    const k = kkiapay({
        privatekey: KKIAPAY_PRIVATE_KEY,
        publickey: KKIAPAY_PUBLIC_KEY,
        secretkey: KKIAPAY_SECRET_KEY,
        sandbox: KKIAPAY_SANDBOX === 'true',
    });

    try {
        const response = await k.verify(transactionId);
        const status = String(response?.status || response?.state || '').toUpperCase();
        const verified = ['SUCCESS', 'SUCCESSFUL', 'COMPLETED'].includes(status) || response?.isPaymentSucces === true;

        return {
            statusCode: 200,
            body: JSON.stringify({
                verified,
                amount: response?.amount ?? null,
                status: status || null,
            }),
        };
    } catch (error) {
        return {
            statusCode: 502,
            body: JSON.stringify({
                error: 'Échec de la vérification auprès de Kkiapay',
                details: String(error?.message || error),
            }),
        };
    }
};
