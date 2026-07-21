import test from 'node:test';
import assert from 'node:assert/strict';
import { parseScalorAgentActionBlocks } from './scalorAgentBlockParser.js';

test('parse la balise plurielle demandée par le prompt', () => {
  const parsed = parseScalorAgentActionBlocks(
    'Je mets la commande à jour.\n<scalor_actions>[{"type":"order.update_status","payload":{"orderId":"SC-1","status":"delivered"}}]</scalor_actions>'
  );

  assert.equal(parsed.actions.length, 1);
  assert.equal(parsed.actions[0].type, 'order.update_status');
  assert.equal(parsed.reply, 'Je mets la commande à jour.');
});

test('accepte aussi la balise singulière observée en production', () => {
  const parsed = parseScalorAgentActionBlocks(
    'Les commandes passent en livré.\n<scalor_action>[{"type":"order.update_status","payload":{"orderId":"SC-2","status":"delivered"}}]</scalor_action>'
  );

  assert.equal(parsed.actions.length, 1);
  assert.equal(parsed.actions[0].payload.orderId, 'SC-2');
  assert.equal(parsed.reply, 'Les commandes passent en livré.');
});

test('accepte un objet unique dans une balise singulière', () => {
  const parsed = parseScalorAgentActionBlocks(
    '<scalor_action>{"type":"order.update_status","payload":{"orderId":"SC-3","status":"delivered"}}</scalor_action>'
  );

  assert.equal(parsed.actions.length, 1);
  assert.equal(parsed.actions[0].payload.status, 'delivered');
  assert.equal(parsed.reply, '');
});

test('masque un bloc technique invalide sans exécuter d’action', () => {
  const parsed = parseScalorAgentActionBlocks(
    'Je ne peux pas exécuter cette action.\n<scalor_action>JSON invalide</scalor_action>'
  );

  assert.deepEqual(parsed.actions, []);
  assert.equal(parsed.reply, 'Je ne peux pas exécuter cette action.');
});

test('limite toujours l’exécution à trois actions', () => {
  const actions = Array.from({ length: 5 }, (_, index) => ({
    type: 'order.update_status',
    payload: { orderId: `SC-${index}`, status: 'delivered' },
  }));
  const parsed = parseScalorAgentActionBlocks(
    `<scalor_actions>${JSON.stringify(actions)}</scalor_actions>`
  );

  assert.equal(parsed.actions.length, 3);
});
