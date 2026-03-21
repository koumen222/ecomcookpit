import cron from 'node-cron';
import PushScheduledNotification from '../models/PushScheduledNotification.js';
import PushAutomation from '../models/PushAutomation.js';
import Subscription from '../models/Subscription.js';
import { sendPushNotification } from './pushService.js';

const DEFAULT_TZ = process.env.PUSH_TZ || 'Africa/Abidjan';

let started = false;
const automationTasks = new Map();

const sendToScope = async ({ scope, workspaceId, payload }) => {
  if (scope === 'workspace') {
    return await sendPushNotification(workspaceId, payload, null);
  }

  const workspaceIds = await Subscription.distinct('workspaceId').catch(() => []);
  let total = 0;
  let successful = 0;
  let failed = 0;

  for (const wsId of workspaceIds) {
    const r = await sendPushNotification(wsId, payload, null);
    total += r.total || 0;
    successful += r.successful || 0;
    failed += r.failed || 0;
  }

  return { success: successful > 0, total, successful, failed };
};

const processScheduled = async () => {
  const now = new Date();
  const jobs = await PushScheduledNotification.find({
    status: 'scheduled',
    sendAt: { $lte: now }
  })
    .sort({ sendAt: 1 })
    .limit(50);

  for (const job of jobs) {
    const updated = await PushScheduledNotification.findOneAndUpdate(
      { _id: job._id, status: 'scheduled' },
      { $set: { status: 'processing' } },
      { new: true }
    );

    if (!updated) continue;

    try {
      const payload = {
        title: updated.title,
        body: updated.body,
        icon: updated.icon,
        badge: updated.badge,
        tag: updated.tag,
        data: {
          ...updated.data,
          url: updated.url || '',
          type: 'super_admin_scheduled',
          scheduledId: updated._id.toString()
        },
        actions: updated.actions || [],
        requireInteraction: updated.requireInteraction || false,
        silent: updated.silent || false
      };

      const result = await sendToScope({
        scope: updated.scope,
        workspaceId: updated.workspaceId,
        payload
      });

      await PushScheduledNotification.updateOne(
        { _id: updated._id },
        {
          $set: {
            status: result.success ? 'sent' : 'failed',
            stats: {
              total: result.total || 0,
              successful: result.successful || 0,
              failed: result.failed || 0
            },
            error: result.success ? '' : 'Push failed'
          }
        }
      );
    } catch (e) {
      await PushScheduledNotification.updateOne(
        { _id: updated._id },
        {
          $set: {
            status: 'failed',
            error: e?.message || 'Unknown error'
          }
        }
      );
    }
  }
};

const ensureDefaultAutomations = async (createdByUserId) => {
  const existing = await PushAutomation.countDocuments({ scope: 'global' }).catch(() => 0);
  if (existing > 0) return;

  const defaults = [
    {
      name: 'Rappel rapports — matin',
      scope: 'global',
      cron: '0 9 * * *',
      timezone: DEFAULT_TZ,
      enabled: true,
      payload: {
        title: 'Rappel',
        body: 'Pensez à remplir votre rapport du jour.',
        url: '/ecom/reports/new',
        tag: 'auto-report-morning'
      }
    },
    {
      name: 'Rappel suivi commandes — midi',
      scope: 'global',
      cron: '0 13 * * *',
      timezone: DEFAULT_TZ,
      enabled: false,
      payload: {
        title: 'Suivi',
        body: 'Vérifiez les commandes en attente et relancez les prospects.',
        url: '/ecom/orders',
        tag: 'auto-midday'
      }
    },
    {
      name: 'Rappel rapports — soir',
      scope: 'global',
      cron: '0 20 * * *',
      timezone: DEFAULT_TZ,
      enabled: true,
      payload: {
        title: 'Fin de journée',
        body: 'Dernier rappel: soumettez votre rapport du jour avant la fin de journée.',
        url: '/ecom/reports/new',
        tag: 'auto-report-evening'
      }
    }
  ];

  await PushAutomation.insertMany(
    defaults.map((d) => ({
      ...d,
      payload: {
        icon: '/icons/icon-192x192.png',
        badge: '/icons/icon-72x72.png',
        ...d.payload
      },
      createdBy: createdByUserId
    }))
  );
};

const scheduleAutomations = async () => {
  const automations = await PushAutomation.find({ enabled: true }).lean().catch(() => []);

  const keep = new Set(automations.map((a) => a._id.toString()));
  for (const [id, task] of automationTasks.entries()) {
    if (!keep.has(id)) {
      task.stop();
      automationTasks.delete(id);
    }
  }

  for (const a of automations) {
    const id = a._id.toString();
    if (automationTasks.has(id)) continue;

    const tz = a.timezone || DEFAULT_TZ;
    const task = cron.schedule(
      a.cron,
      async () => {
        try {
          const payload = {
            title: a.payload?.title || 'Notification',
            body: a.payload?.body || '',
            icon: a.payload?.icon,
            badge: a.payload?.badge,
            tag: a.payload?.tag || 'automation',
            data: {
              url: a.payload?.url || '',
              type: 'super_admin_automation',
              automationId: id
            }
          };

          const result = await sendToScope({ scope: a.scope, workspaceId: a.workspaceId, payload });

          await PushAutomation.updateOne(
            { _id: a._id },
            {
              $set: {
                lastRunAt: new Date(),
                lastResult: {
                  total: result.total || 0,
                  successful: result.successful || 0,
                  failed: result.failed || 0
                }
              }
            }
          );
        } catch (e) {
          await PushAutomation.updateOne(
            { _id: a._id },
            { $set: { lastRunAt: new Date() } }
          );
        }
      },
      { timezone: tz }
    );

    automationTasks.set(id, task);
  }
};

const startPushSchedulerJobs = async () => {
  if (started) return;
  started = true;

  cron.schedule('* * * * *', async () => {
    try {
      await processScheduled();
    } catch {
    }
  });

  cron.schedule('*/2 * * * *', async () => {
    try {
      await scheduleAutomations();
    } catch {
    }
  });
};

export {
  startPushSchedulerJobs,
  ensureDefaultAutomations,
  scheduleAutomations,
  sendToScope
};
