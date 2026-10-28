from coach import AICoach

coach = AICoach(coach_name='TestCoach', app_name='Athleo', focus_area='fitness')
msg = 'Can you tell me about your subscription plans and pricing?'
print('User:', msg)
print('Coach:', coach.respond({}, msg))
