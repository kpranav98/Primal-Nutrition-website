import { Router } from 'express'
import { runDailyFollowups } from '../services/followupService.js'
import { reconcilePendingShipments } from './checkout.js'
import { config } from '../config.js'
import { logger } from '../utils/logger.js'

const router = Router()

function checkCronAuth(req, res) {
  if (!config.cronSecret) {
    res.status(503).json({ error: 'CRON_NOT_CONFIGURED', message: 'CRON_SECRET is not set on the server.' })
    return false
  }
  const header = req.get('authorization') || ''
  if (header !== `Bearer ${config.cronSecret}`) {
    res.status(401).json({ error: 'UNAUTHORIZED', message: 'Invalid or missing bearer token.' })
    return false
  }
  return true
}

/**
 * POST /cron/send-followups
 *
 * Auth: `Authorization: Bearer ${CRON_SECRET}` header.
 *
 * Triggers the daily followup-email sweep (day-14 check-in + 30-day reorder reminder).
 * Returns the aggregated summary from runDailyFollowups.
 */
router.post('/send-followups', async (req, res, next) => {
  try {
    if (!config.cronSecret) {
      return res.status(503).json({
        error: 'CRON_NOT_CONFIGURED',
        message: 'CRON_SECRET is not set on the server.',
      })
    }

    const header = req.get('authorization') || ''
    const expected = `Bearer ${config.cronSecret}`
    if (header !== expected) {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Invalid or missing bearer token.',
      })
    }

    const summary = await runDailyFollowups()
    logger.info({ summary }, 'Daily followup cron completed')
    return res.json(summary)
  } catch (err) {
    next(err)
  }
})

/**
 * POST /cron/reconcile-shipments
 *
 * Auth: `Authorization: Bearer ${CRON_SECRET}` header.
 *
 * Recovers orders that should have shipped but have no AWB (background shipment
 * failures / deferred-AWB misses). Safe to run on a schedule.
 */
router.post('/reconcile-shipments', async (req, res, next) => {
  try {
    if (!checkCronAuth(req, res)) return
    const summary = await reconcilePendingShipments()
    logger.info({ summary: { checked: summary.checked, reconciled: summary.reconciled, needsManualAwb: summary.needsManualAwb, failed: summary.failed } }, 'Shipment reconciliation cron completed')
    return res.json(summary)
  } catch (err) {
    next(err)
  }
})

export default router
