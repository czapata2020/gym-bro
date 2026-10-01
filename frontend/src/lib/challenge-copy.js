import { baseLang, getLang, t } from './i18n-core.js'

// Challenges is a Gym Bro module rather than part of upstream openGym. Keeping its first
// translation beside the feature lets the upstream locale packs stay in lockstep while the
// module grows; languages without a module pack deliberately receive the English source copy.
const ES = {
  'Challenges': 'Retos',
  'Challenge': 'Reto',
  'Gym Bro': 'Gym Bro',
  'Consistency wins. Weight confirms the result.': 'La constancia gana. El peso confirma el resultado.',
  'Create challenge': 'Crear reto',
  'Join with code': 'Unirme con código',
  'Join challenge': 'Unirme al reto',
  'Create': 'Crear',
  'Join': 'Unirme',
  'Challenge name': 'Nombre del reto',
  'Wedding 2026': 'Boda 2026',
  'Starts': 'Comienza',
  'Ends': 'Termina',
  'Workouts per week': 'Entrenamientos por semana',
  'The stake': 'El castigo',
  'The loser cooks dinner for a week': 'El perdedor cocina durante una semana',
  'Invitation code': 'Código de invitación',
  'Starting weight': 'Peso inicial',
  'Target weight': 'Peso objetivo',
  'Your exact weight stays private. Your rival only sees progress percentages.': 'Tu peso exacto es privado. Tu rival solo ve porcentajes de progreso.',
  'Your first challenge starts here': 'Tu primer reto comienza aquí',
  'Invite one person and compete through weekly consistency, with weight as supporting evidence.': 'Invita a una persona y compitan por constancia semanal, usando el peso como evidencia complementaria.',
  'Waiting for a rival': 'Esperando rival',
  'vs {0}': 'vs. {0}',
  'Your rival': 'Tu rival',
  'Not joined yet': 'Aún no se une',
  'Leading': 'Va ganando',
  'Overall score': 'Puntaje total',
  'Final': 'Final',
  '{0} days left': 'Quedan {0} días',
  'Share the code to start the duel.': 'Comparte el código para comenzar el duelo.',
  'The challenge is tied right now.': 'El reto está empatado por ahora.',
  '{0} is leading the challenge.': '{0} va ganando el reto.',
  'Send this code to your rival.': 'Envía este código a tu rival.',
  'Your score': 'Tu puntaje',
  '75% consistency · 25% weight': '75% constancia · 25% peso',
  'Consistency': 'Constancia',
  'Weight trajectory': 'Trayectoria de peso',
  'workouts this week': 'entrenamientos esta semana',
  'weekly weigh-in': 'pesaje semanal',
  'Pending': 'Pendiente',
  'Log this week’s weight': 'Registrar el peso de esta semana',
  'Progress': 'Progreso',
  'Weekly commitment': 'Compromiso semanal',
  '{0} workouts': '{0} entrenamientos',
  'Weights are private; only percentages and scores are shared.': 'Los pesos son privados; solo se comparten porcentajes y puntajes.',
  'Change photo': 'Cambiar foto',
  'Processing photo…': 'Procesando foto…',
  'Sign in to use shared challenges': 'Inicia sesión para usar retos compartidos',
  'Back to challenges': 'Volver a retos',
  'That invitation code does not exist.': 'Ese código de invitación no existe.',
  'This challenge already has two participants.': 'Este reto ya tiene dos participantes.',
  'You already joined this challenge.': 'Ya te uniste a este reto.',
  'Enter a valid starting and target weight.': 'Ingresa pesos inicial y objetivo válidos.',
  'Check the dates, weekly goal and weights.': 'Revisa las fechas, la meta semanal y los pesos.',
  'Something went wrong. Try again.': 'Algo salió mal. Inténtalo de nuevo.',
  'Saving…': 'Guardando…'
}

export function ct(source, ...args) {
  let value = baseLang(getLang()) === 'es' ? (ES[source] || t(source)) : t(source)
  for (let i = 0; i < args.length; i++) value = value.replaceAll('{' + i + '}', args[i])
  return value
}
