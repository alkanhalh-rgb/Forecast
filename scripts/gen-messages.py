# One-off generator for the initial translation files (kept for reference; edit the JSON directly afterwards).
import json, sys
M = {}
def s(key, ar, en):
    M[key] = (ar, en)

s('common.appName', 'بصيرة', 'Basira')
s('common.tagline', 'توقّع. ارفع دقتك. تحدَّ أصدقاءك.', 'Forecast. Sharpen your accuracy. Challenge friends.')
s('common.loading', 'جارٍ التحميل…', 'Loading…')
s('common.save', 'حفظ', 'Save')
s('common.cancel', 'إلغاء', 'Cancel')
s('common.continue', 'متابعة', 'Continue')
s('common.back', 'رجوع', 'Back')
s('common.submit', 'إرسال', 'Submit')
s('common.retry', 'إعادة المحاولة', 'Retry')
s('common.close', 'إغلاق', 'Close')
s('common.points', 'نقطة', 'pts')
s('common.free', 'مجاني بالكامل — لا مال ولا جوائز، فقط الدقة والمكانة.', 'Completely free — no money, no prizes, just accuracy and status.')
s('common.skipToContent', 'تخطَّ إلى المحتوى', 'Skip to content')
s('common.copy', 'نسخ', 'Copy')
s('common.copied', 'تم النسخ', 'Copied')
s('common.share', 'مشاركة', 'Share')
s('common.timesRiyadh', 'جميع الأوقات بتوقيت الرياض', 'All times are Riyadh time')
s('common.none', 'لا يوجد', 'None')
s('common.you', 'أنت', 'You')

s('nav.feed', 'التوقعات', 'Forecasts')
s('nav.leagues', 'الدوري', 'League')
s('nav.leaderboards', 'الترتيب', 'Rankings')
s('nav.duels', 'التحديات', 'Challenges')
s('nav.friends', 'الأصدقاء', 'Friends')
s('nav.me', 'حسابي', 'Me')
s('nav.admin', 'الإدارة', 'Admin')
s('nav.main', 'التنقل الرئيسي', 'Main navigation')
s('nav.switchLanguage', 'English', 'العربية')
s('nav.switchLanguageLabel', 'التبديل إلى الإنجليزية', 'Switch to Arabic')
s('nav.login', 'الدخول', 'Sign in')

s('auth.title', 'سجّل الدخول برقم جوالك', 'Sign in with your mobile number')
s('auth.phoneLabel', 'رقم الجوال السعودي', 'Saudi mobile number')
s('auth.phoneHint', 'مثال: 05XXXXXXXX', 'Example: 05XXXXXXXX')
s('auth.sendCode', 'أرسل الرمز', 'Send code')
s('auth.codeLabel', 'رمز التحقق (6 أرقام)', 'Verification code (6 digits)')
s('auth.codeSent', 'أرسلنا رمزاً إلى {phone}. صالح لمدة 5 دقائق.', 'We sent a code to {phone}. It is valid for 5 minutes.')
s('auth.verify', 'تحقق', 'Verify')
s('auth.changeNumber', 'تغيير الرقم', 'Change number')
s('auth.logout', 'تسجيل الخروج', 'Sign out')
s('auth.privacyShort', 'نجمع رقم الجوال والاسم المستعار والمدينة والاهتمامات فقط.', 'We only collect your phone number, nickname, city and interests.')

s('onboarding.step', 'الخطوة {n} من {total}', 'Step {n} of {total}')
s('onboarding.ageTitle', 'قبل أن نبدأ', 'Before we start')
s('onboarding.ageConfirm', 'أؤكد أن عمري 18 سنة أو أكثر', 'I confirm I am 18 or older')
s('onboarding.privacyAccept', 'قرأت إشعار الخصوصية وأوافق عليه', 'I have read and accept the privacy notice')
s('onboarding.privacyNotice', 'نحفظ رقم جوالك مشفراً ولا نعرضه لأحد. يظهر اسمك المستعار فقط في الترتيب. يمكنك تصدير بياناتك أو حذف حسابك في أي وقت من صفحة حسابي.', 'Your phone number is stored encrypted and never shown to anyone. Only your nickname appears in rankings. You can export your data or delete your account at any time from the Me page.')
s('onboarding.profileTitle', 'اختر اسمك المستعار', 'Choose your nickname')
s('onboarding.nickname', 'الاسم المستعار (يظهر للجميع)', 'Nickname (public)')
s('onboarding.nicknameHint', '3 إلى 20 حرفاً أو رقماً أو _', '3 to 20 letters, digits or _')
s('onboarding.city', 'المدينة', 'City')
s('onboarding.interestsTitle', 'اختر 3 اهتمامات', 'Pick 3 interests')
s('onboarding.interestsCount', 'اخترت {n} من 3', '{n} of 3 selected')
s('onboarding.warmupTitle', 'توقعات الإحماء', 'Warm-up forecasts')
s('onboarding.warmupIntro', 'أجب عن 3 أسئلة تُحسم اليوم لتبدأ رحلتك.', 'Answer 3 questions that resolve today to get started.')
s('onboarding.warmupProgress', 'أجبت عن {n} من {total}', '{n} of {total} answered')
s('onboarding.warmupNone', 'لا توجد أسئلة تُحسم اليوم الآن. يمكنك المتابعة.', 'No questions resolve today right now. You can continue.')
s('onboarding.finish', 'ابدأ', 'Let’s go')

for c, ar, en in [('riyadh','الرياض','Riyadh'),('jeddah','جدة','Jeddah'),('makkah','مكة المكرمة','Makkah'),('madinah','المدينة المنورة','Madinah'),('dammam','الدمام','Dammam'),('khobar','الخبر','Khobar'),('dhahran','الظهران','Dhahran'),('taif','الطائف','Taif'),('tabuk','تبوك','Tabuk'),('abha','أبها','Abha'),('buraidah','بريدة','Buraidah'),('hail','حائل','Hail'),('jazan','جازان','Jazan'),('najran','نجران','Najran'),('al_ahsa','الأحساء','Al Ahsa'),('jubail','الجبيل','Jubail'),('yanbu','ينبع','Yanbu'),('khamis_mushait','خميس مشيط','Khamis Mushait'),('al_baha','الباحة','Al Baha'),('arar','عرعر','Arar'),('sakaka','سكاكا','Sakaka'),('other','أخرى','Other')]:
    s(f'cities.{c}', ar, en)

s('time.minutes', '{n} دقيقة', '{n} min')
s('time.hours', '{n} س {m} د', '{n}h {m}m')
s('feed.title', 'أسئلة اليوم', 'Today’s questions')
s('feed.all', 'الكل', 'All')
s('feed.filterLabel', 'تصفية حسب الفئة', 'Filter by category')
s('feed.locksAt', 'يُقفل {time}', 'Locks {time}')
s('feed.locksIn', 'يُقفل خلال {time}', 'Locks in {time}')
s('feed.empty', 'لا توجد أسئلة مفتوحة الآن. عد لاحقاً.', 'No open questions right now. Check back soon.')
s('feed.answered', 'أجبت', 'Answered')
s('feed.forecasters', '{n} متوقِّع', '{n} forecasters')

s('question.source', 'مصدر الحسم', 'Resolution source')
s('question.lockAt', 'يُقفل', 'Locks')
s('question.resolveBy', 'يُحسم قبل', 'Resolves by')
s('question.chooseOption', 'اختر توقعك', 'Choose your forecast')
s('question.chooseConfidence', 'ما مدى ثقتك؟', 'How confident are you?')
s('question.confidence', 'ثقة {n}', '{n} confidence')
s('question.scorePreview', 'إن أصبت: {win} · إن أخطأت: {lose}', 'If right: {win} · If wrong: {lose}')
s('question.submit', 'سجّل توقعي', 'Save my forecast')
s('question.update', 'حدّث توقعي', 'Update my forecast')
s('question.saved', 'تم حفظ توقعك', 'Your forecast is saved')
s('question.queued', 'تم استلام توقعك وجارٍ حفظه', 'Your forecast was received and is being saved')
s('question.yourForecast', 'توقعك: {option} بثقة {n}', 'Your forecast: {option} at {n} confidence')
s('question.changeUntil', 'يمكنك تغيير توقعك حتى {time}. آخر توقع هو المعتمد.', 'You can change your forecast until {time}. The last one counts.')
s('question.crowd', 'توقعات الجمهور', 'Crowd forecast')
s('question.crowdHidden', 'تظهر نسب الجمهور بعد أن تسجّل توقعك.', 'The crowd split appears after you forecast.')
s('question.crowdTotal', '{n} متوقِّع', '{n} forecasters')
s('question.lockedNotice', 'أُقفل هذا السؤال ولا يقبل توقعات جديدة.', 'This question is locked and no longer accepts forecasts.')
s('question.resolvedWith', 'النتيجة: {option}', 'Outcome: {option}')
s('question.yourScore', 'نتيجتك: {points}', 'Your score: {points}')
s('question.voided', 'أُلغي هذا السؤال ({reason}). لا يحتسب لأحد.', 'This question was voided ({reason}). It counts for nobody.')
s('question.correction', 'تصحيح: {note}', 'Correction: {note}')
s('question.report', 'الإبلاغ عن هذه النتيجة', 'Report this result')
s('question.reportUntil', 'متاح حتى {time}', 'Available until {time}')
s('question.evidenceUrl', 'رابط الدليل', 'Evidence link')
s('question.reportMessage', 'ما الخطأ في النتيجة؟', 'What is wrong with the result?')
s('question.reportSent', 'وصلنا بلاغك وسنراجعه.', 'We received your report and will review it.')
s('question.challenge', 'تحدَّ صديقاً على هذا السؤال', 'Challenge a friend on this question')
s('question.signInToForecast', 'سجّل الدخول لتتوقع', 'Sign in to forecast')

for k, ar, en in [('DRAFT','مسودة','Draft'),('REVIEW','قيد المراجعة','In review'),('LIVE','مفتوح','Open'),('LOCKED','مُقفل','Locked'),('RESOLVED','محسوم','Resolved'),('FINAL','نهائي','Final'),('VOID','ملغى','Void')]:
    s(f'status.{k}', ar, en)
for k, ar, en in [('POSTPONED','تأجيل الحدث','event postponed'),('ABANDONED','إلغاء الحدث','event abandoned'),('SOURCE_UNAVAILABLE_48H','تعذّر الوصول إلى المصدر 48 ساعة','source unavailable for 48 hours'),('AMBIGUOUS','صياغة غير واضحة','ambiguous wording')]:
    s(f'voidReason.{k}', ar, en)

s('leaderboards.title', 'الترتيب', 'Rankings')
s('leaderboards.week', 'هذا الأسبوع', 'This week')
s('leaderboards.season', 'هذا الموسم', 'This season')
s('leaderboards.category', 'حسب الفئة', 'By category')
s('leaderboards.friends', 'الأصدقاء', 'Friends')
s('leaderboards.rank', 'المركز', 'Rank')
s('leaderboards.player', 'المتوقِّع', 'Forecaster')
s('leaderboards.points', 'النقاط', 'Points')
s('leaderboards.empty', 'لا توجد نتائج بعد.', 'No results yet.')
s('leaderboards.yourRank', 'مركزك: {rank}', 'Your rank: {rank}')

s('league.title', 'دوري الأسبوع', 'Weekly league')
s('league.division', 'الدرجة {n}', 'Division {n}')
s('league.intro', 'مجموعات من 30. أعلى 5 يصعدون وأدنى 5 يهبطون كل أحد 00:00 بتوقيت الرياض.', 'Groups of 30. Top 5 move up and bottom 5 move down every Sunday 00:00 Riyadh time.')
s('league.notJoined', 'سجّل توقعك الأول هذا الأسبوع لتنضم إلى مجموعة.', 'Make your first forecast this week to join a group.')
s('league.promotion', 'منطقة الصعود', 'Promotion zone')
s('league.relegation', 'منطقة الهبوط', 'Relegation zone')
s('league.endsAt', 'ينتهي الأسبوع {time}', 'Week ends {time}')
s('league.lastWeek', 'الأسبوع الماضي: المركز {rank} — {movement}', 'Last week: rank {rank} — {movement}')
s('movement.UP', 'صعود', 'Moved up')
s('movement.DOWN', 'هبوط', 'Moved down')
s('movement.STAY', 'بقاء', 'Stayed')

s('duels.title', 'التحديات', 'Challenges')
s('duels.intro', 'تحدَّ صديقاً على سؤال أو ثلاثة. الفائز يكسب شارة وتصنيف تحدٍّ فقط — لا نقاط ولا شيء آخر.', 'Challenge a friend on one or three questions. The winner earns a badge and challenge rating only — no points, nothing else.')
s('duels.new', 'تحدٍّ جديد', 'New challenge')
s('duels.SINGLE', 'سؤال واحد', 'Single question')
s('duels.BEST_OF_3', 'الأفضل من 3', 'Best of 3')
s('duels.format', 'نوع التحدي', 'Challenge format')
s('duels.pickQuestion', 'اختر السؤال', 'Pick a question')
s('duels.pickAnswer', 'اختر إجابتك', 'Pick your answer')
s('duels.opponent', 'اسم المنافس المستعار (اختياري)', 'Opponent nickname (optional)')
s('duels.opponentHint', 'اتركه فارغاً لمشاركة رابط مفتوح', 'Leave empty to share an open link')
s('duels.create', 'أرسل التحدي', 'Send challenge')
s('duels.shareLink', 'رابط التحدي', 'Challenge link')
s('duels.vs', '{a} ضد {b}', '{a} vs {b}')
s('duels.waiting', 'بانتظار المنافس', 'Waiting for an opponent')
s('duels.accept', 'اقبل التحدي', 'Accept challenge')
s('duels.mustDiffer', 'يجب أن تختار إجابة مختلفة عن منافسك.', 'You must pick a different answer from your opponent.')
s('duels.pickQ2', 'اختر السؤال الثاني وإجابتك عليه', 'Pick question 2 and your answer')
s('duels.q3System', 'السؤال الثالث يختاره النظام من الأسئلة المفتوحة', 'Question 3 is chosen by the system from open questions')
s('duels.yourTurn', 'دورك: أجب عن السؤال {n}', 'Your turn: answer question {n}')
s('duels.question', 'السؤال {n}', 'Question {n}')
s('duels.picked', '{who} اختار: {option}', '{who} picked: {option}')
s('duels.hiddenPick', 'إجابة المنافس تظهر بعد إجابتك', 'The opponent’s answer appears after yours')
s('duels.won', 'فزت بالتحدي!', 'You won the challenge!')
s('duels.lost', 'فاز منافسك هذه المرة', 'Your opponent won this time')
s('duels.tie', 'تعادل', 'Tie')
s('duels.rating', 'تصنيف التحدي: {n}', 'Challenge rating: {n}')
s('duels.ratingNote', 'تصنيف التحدي منفصل تماماً عن النقاط والترتيب.', 'The challenge rating is completely separate from points and rankings.')
s('duels.pairLimit', 'وصلتما إلى الحد الأقصى: 3 تحديات أسبوعياً بين نفس الشخصين.', 'Limit reached: 3 challenges per week between the same two people.')
s('duels.empty', 'لا توجد تحديات بعد.', 'No challenges yet.')
s('duels.expiresAt', 'ينتهي القبول {time}', 'Acceptance closes {time}')
for k, ar, en in [('PENDING','بانتظار القبول','Pending'),('ACTIVE','جارٍ','Active'),('DONE','منتهٍ','Finished'),('VOID','ملغى','Void'),('EXPIRED','انتهت مهلته','Expired')]:
    s(f'duelStatus.{k}', ar, en)
s('duels.score', '{a} - {b}', '{a} - {b}')
s('duels.challengeOn', 'تحدٍّ على: {q}', 'Challenge on: {q}')

s('friends.title', 'دوريات الأصدقاء', 'Friend leagues')
s('friends.create', 'أنشئ دورياً', 'Create a league')
s('friends.name', 'اسم الدوري', 'League name')
s('friends.join', 'انضم', 'Join')
s('friends.joinWithCode', 'انضم برمز الدعوة', 'Join with an invite code')
s('friends.code', 'رمز الدعوة', 'Invite code')
s('friends.inviteLink', 'رابط الدعوة', 'Invite link')
s('friends.members', '{n} من 50 عضواً', '{n} of 50 members')
s('friends.full', 'هذا الدوري ممتلئ (50 عضواً).', 'This league is full (50 members).')
s('friends.weekRanking', 'ترتيب هذا الأسبوع', 'This week’s ranking')
s('friends.empty', 'لم تنضم إلى أي دوري بعد.', 'You have not joined any league yet.')
s('friends.joinedTitle', 'دعوة إلى دوري', 'League invitation')
s('friends.joinPrompt', 'دعاك أصدقاؤك إلى «{name}».', 'Your friends invited you to “{name}”.')

s('me.title', 'حسابي', 'My account')
s('me.seasonPoints', 'نقاط الموسم', 'Season points')
s('me.weekPoints', 'نقاط الأسبوع', 'This week')
s('me.accuracy', 'معدل الدقة (30 يوماً)', 'Accuracy rating (30 days)')
s('me.accuracyHidden', 'يظهر بعد 20 توقعاً محسوباً ({n}/20)', 'Shown after 20 scored forecasts ({n}/20)')
s('me.streak', 'سلسلة الأيام', 'Day streak')
s('me.streakDays', '{n} يوم', '{n} days')
s('me.bestStreak', 'الأفضل: {n}', 'Best: {n}')
s('me.shield', 'درع الأسبوع: {state}', 'Weekly shield: {state}')
s('me.shieldAvailable', 'متاح', 'available')
s('me.shieldUsed', 'مُستخدم', 'used')
s('me.badges', 'الشارات', 'Badges')
s('me.noBadges', 'لا شارات بعد. استمر في التوقع!', 'No badges yet. Keep forecasting!')
s('me.duelRating', 'تصنيف التحديات', 'Challenge rating')
s('me.recent', 'آخر النتائج', 'Recent results')
s('me.privacy', 'الخصوصية وبياناتك', 'Privacy and your data')
s('me.export', 'تصدير بياناتي', 'Export my data')
s('me.delete', 'حذف حسابي نهائياً', 'Delete my account permanently')
s('me.deleteConfirm', 'سيُحذف حسابك وكل بياناتك نهائياً. اكتب اسمك المستعار للتأكيد.', 'Your account and all your data will be deleted permanently. Type your nickname to confirm.')
s('me.notifications', 'الإشعارات', 'Notifications')
s('me.enablePush', 'فعّل الإشعارات', 'Enable notifications')
s('me.pushEnabled', 'الإشعارات مفعّلة', 'Notifications are on')
s('me.pushUnsupported', 'متصفحك لا يدعم الإشعارات.', 'Your browser does not support notifications.')
s('me.quietHours', 'لا نرسل إشعارات بين 23:00 و07:00 بتوقيت الرياض.', 'We never send notifications between 23:00 and 07:00 Riyadh time.')
s('me.inbox', 'صندوق الإشعارات', 'Notification inbox')
s('me.inboxEmpty', 'لا إشعارات.', 'No notifications.')
s('me.shareCards', 'بطاقات المشاركة', 'Share cards')
s('me.forecasts', 'التوقعات المحسوبة: {n}', 'Scored forecasts: {n}')

for k, ar, en, dar, den in [
    ('CALIBRATED','مُعايَر','Calibrated','30 توقعاً أو أكثر بثقة 75% بنسبة إصابة بين 65% و85%','30+ forecasts at 75% with a hit rate between 65% and 85%'),
    ('BEAT_THE_CROWD','تفوّقت على الجمهور','Beat the Crowd','أصبت حين اختار أقل من 30% من 20 متوقِّعاً أو أكثر نفس الإجابة','Right when under 30% of at least 20 forecasters chose that answer'),
    ('DUEL_WIN_1','أول فوز في تحدٍّ','First challenge win','فزت بأول تحدٍّ','Won your first challenge'),
    ('DUEL_WIN_10','10 انتصارات','10 challenge wins','فزت بـ 10 تحديات','Won 10 challenges'),
    ('DUEL_WIN_50','50 انتصاراً','50 challenge wins','فزت بـ 50 تحدياً','Won 50 challenges'),
    ('SEASON_CATEGORY_TITLE','لقب الموسم','Season title','ضمن أفضل 1% في فئة خلال الموسم','Top 1% in a category for the season')]:
    s(f'badges.{k}.name', ar, en); s(f'badges.{k}.desc', dar, den)

s('share.duelWin', 'فزت بتحدٍّ على {platform}', 'I won a challenge on {platform}')
s('share.beatCrowd', 'تفوّقت على الجمهور', 'I beat the crowd')

s('notifications.RESOLUTION.title', 'حُسم سؤال توقعته', 'A question you forecast was resolved')
s('notifications.RESOLUTION.body', '{question} — نتيجتك {points}', '{question} — your score {points}')
s('notifications.VOID.title', 'أُلغي سؤال توقعته', 'A question you forecast was voided')
s('notifications.VOID.body', '{question} — لا يحتسب لأحد', '{question} — it counts for nobody')
s('notifications.CORRECTION.title', 'تصحيح نتيجة', 'Result corrected')
s('notifications.CORRECTION.body', '{question} — نتيجتك الآن {points}', '{question} — your score is now {points}')
s('notifications.DUEL_CHALLENGE.title', 'لديك تحدٍّ جديد', 'You have a new challenge')
s('notifications.DUEL_CHALLENGE.body', '{nickname} يتحداك', '{nickname} challenged you')
s('notifications.DUEL_RESULT.title', 'انتهى تحدٍّ', 'A challenge has finished')
s('notifications.DUEL_RESULT.body', '{result}', '{result}')
s('notifications.DISPUTE_DECISION.title', 'قرار بشأن بلاغك', 'Decision on your report')
s('notifications.DISPUTE_DECISION.body', '{question} — {decision}', '{question} — {decision}')
s('notifications.duelWon', 'فزت!', 'You won!')
s('notifications.duelLost', 'فاز منافسك', 'Your opponent won')
s('notifications.duelTie', 'تعادل', 'Tie')
s('notifications.duelVoid', 'أُلغي التحدي', 'The challenge was voided')
s('notifications.UPHELD', 'قُبل البلاغ', 'Report upheld')
s('notifications.REJECTED', 'رُفض البلاغ', 'Report rejected')

s('admin.title', 'لوحة الإدارة', 'Admin console')
s('admin.questions', 'الأسئلة', 'Questions')
s('admin.new', 'سؤال جديد', 'New question')
s('admin.fromTemplate', 'من قالب', 'From template')
s('admin.templates', 'القوالب المتكررة', 'Recurring templates')
s('admin.reviewQueue', 'بانتظار المراجعة', 'Review queue')
s('admin.resolveQueue', 'بانتظار الحسم', 'Awaiting resolution')
s('admin.confirmQueue', 'بانتظار التأكيد', 'Awaiting confirmation')
s('admin.disputes', 'البلاغات', 'Disputes')
s('admin.audit', 'سجل التدقيق', 'Audit log')
s('admin.category', 'الفئة', 'Category')
s('admin.textAr', 'نص السؤال (عربي)', 'Question text (Arabic)')
s('admin.textEn', 'نص السؤال (إنجليزي)', 'Question text (English)')
s('admin.options', 'الخيارات', 'Options')
s('admin.optionAr', 'الخيار (عربي)', 'Option (Arabic)')
s('admin.optionEn', 'الخيار (إنجليزي)', 'Option (English)')
s('admin.addOption', 'أضف خياراً', 'Add option')
s('admin.removeOption', 'احذف الخيار', 'Remove option')
s('admin.lockAt', 'وقت الإقفال (الرياض)', 'Lock time (Riyadh)')
s('admin.resolveBy', 'يُحسم قبل (الرياض)', 'Resolve by (Riyadh)')
s('admin.sourceName', 'اسم المصدر', 'Source name')
s('admin.sourceUrl', 'رابط المصدر', 'Source URL')
s('admin.saveDraft', 'احفظ المسودة', 'Save draft')
s('admin.checklist', 'قائمة التحقق قبل النشر', 'Publish checklist')
s('admin.submitReview', 'أرسل للمراجعة', 'Submit for review')
s('admin.approve', 'اعتمد وانشر', 'Approve and publish')
s('admin.reject', 'أعد إلى المسودة', 'Send back to draft')
s('admin.sameReviewer', 'يجب أن يكون المراجع شخصاً مختلفاً عن المُنشئ.', 'The reviewer must be a different person from the creator.')
s('admin.resolve', 'أدخل النتيجة', 'Enter outcome')
s('admin.winningOption', 'الخيار الفائز', 'Winning option')
s('admin.resolutionSource', 'رابط مصدر النتيجة', 'Outcome source URL')
s('admin.confirm', 'أكّد النتيجة وشغّل الاحتساب', 'Confirm outcome and run scoring')
s('admin.differentConfirmer', 'يجب أن يؤكد النتيجة شخص مختلف.', 'A different person must confirm the outcome.')
s('admin.proposed', 'النتيجة المقترحة: {option} (بواسطة {who})', 'Proposed outcome: {option} (by {who})')
s('admin.void', 'ألغِ السؤال', 'Void question')
s('admin.voidReason', 'سبب الإلغاء', 'Void reason')
s('admin.correct', 'صحّح النتيجة', 'Correct outcome')
s('admin.correctionNote', 'ملاحظة التصحيح (تظهر للجميع)', 'Correction note (public)')
s('admin.decide', 'قرّر', 'Decide')
s('admin.uphold', 'قبول', 'Uphold')
s('admin.rejectDispute', 'رفض', 'Reject')
s('admin.decisionNote', 'سبب القرار', 'Decision note')
s('admin.generate', 'أنشئ مسودة', 'Create draft')
s('admin.created', 'أُنشئت المسودة', 'Draft created')
s('admin.autoChecks', 'فحوص تلقائية', 'Automatic checks')
s('admin.attestations', 'إقرارات', 'Attestations')
s('admin.lockNow', 'أُقفل الآن', 'Locked now')
for k, ar, en in [
    ('sourceNamed','مصدر عام مُسمّى','One named public source'),
    ('sourceUrlValid','رابط المصدر صالح (https)','Source URL is valid (https)'),
    ('resolvesWithin24h','يُحسم خلال 24 ساعة من النشر','Resolves within 24 hours of publishing'),
    ('lockInFuture','وقت الإقفال في المستقبل','Lock time is in the future'),
    ('lockBeforeResolve','الإقفال قبل الحسم','Lock is before resolution'),
    ('noBannedWords','لا كلمات محظورة','No banned words'),
    ('noBlockedKeywords','لا كلمات لمواضيع محظورة','No blocked-topic keywords'),
    ('optionsValid','خيارات صالحة وغير مكررة','Options are valid and not duplicated'),
    ('lockBeforeOutcomePublic','الإقفال قبل أن تصبح النتيجة معروفة','Lock is set before any outcome is public'),
    ('notBlockedTopic','ليس موضوعاً محظوراً (وفيات، إصابات، حوادث، جرائم، شؤون دينية، سياسة، قرارات حكومية، الأسرة المالكة، أفراد بأسمائهم، أو أي شيء قد يرغب الناس في إحداثه)','Not a blocked topic (deaths, injuries, accidents, crimes, religious matters, politics, government decisions, the royal family, named private individuals, or anything people might want to cause)'),
    ('neutralWording','صياغة محايدة','Neutral wording'),
    ('optionsExclusiveExhaustive','الخيارات لا تتداخل وتغطي كل النتائج','Options do not overlap and cover every outcome')]:
    s(f'checklist.{k}', ar, en)

for k, ar, en in [
    ('UNAUTHENTICATED','يجب تسجيل الدخول.','Please sign in.'),
    ('ONBOARDING_REQUIRED','أكمل التسجيل أولاً.','Please finish sign-up first.'),
    ('FORBIDDEN','ليست لديك صلاحية.','You do not have permission.'),
    ('VALIDATION','تحقق من البيانات المدخلة.','Please check what you entered.'),
    ('INVALID_PHONE','أدخل رقم جوال سعودياً صحيحاً.','Enter a valid Saudi mobile number.'),
    ('CODE_INVALID','الرمز غير صحيح.','The code is incorrect.'),
    ('CODE_EXPIRED','انتهت صلاحية الرمز. اطلب رمزاً جديداً.','The code has expired. Request a new one.'),
    ('RATE_LIMITED','محاولات كثيرة. حاول لاحقاً.','Too many attempts. Try again later.'),
    ('NICKNAME_TAKEN','هذا الاسم مستخدم.','That nickname is taken.'),
    ('NICKNAME_NOT_ALLOWED','هذا الاسم غير مسموح.','That nickname is not allowed.'),
    ('AGE_CONFIRMATION_REQUIRED','يجب تأكيد أن عمرك 18 سنة أو أكثر.','You must confirm you are 18 or older.'),
    ('INVALID_INTERESTS','اختر 3 اهتمامات.','Pick 3 interests.'),
    ('QUESTION_LOCKED','أُقفل السؤال ولم يعد يقبل توقعات.','The question is locked and no longer accepts forecasts.'),
    ('QUESTION_NOT_LIVE','هذا السؤال غير مفتوح.','This question is not open.'),
    ('INVALID_OPTION','خيار غير صالح.','Invalid option.'),
    ('NOT_FOUND','غير موجود.','Not found.'),
    ('CHECKLIST_INCOMPLETE','أكمل قائمة التحقق قبل النشر.','Complete the publish checklist first.'),
    ('SAME_PERSON','يجب أن يكون شخصاً مختلفاً.','This must be a different person.'),
    ('INVALID_STATE','لا يمكن تنفيذ هذا الإجراء في الحالة الحالية.','This action is not allowed in the current state.'),
    ('DISPUTE_WINDOW_CLOSED','انتهت مهلة الإبلاغ.','The report window has closed.'),
    ('ALREADY_REPORTED','أبلغت عن هذه النتيجة مسبقاً.','You already reported this result.'),
    ('DUEL_PAIR_LIMIT','وصلتما إلى حد 3 تحديات أسبوعياً.','You have reached 3 challenges this week with this person.'),
    ('DUEL_SAME_OPTION','اختر إجابة مختلفة عن منافسك.','Pick a different answer from your opponent.'),
    ('DUEL_SELF','لا يمكنك تحدي نفسك.','You cannot challenge yourself.'),
    ('DUEL_NOT_OPEN','هذا التحدي غير متاح.','This challenge is not available.'),
    ('DUEL_NO_Q3','لا توجد أسئلة كافية للسؤال الثالث الآن.','Not enough open questions for question 3 right now.'),
    ('USER_NOT_FOUND','لم نجد هذا الاسم.','We could not find that nickname.'),
    ('LEAGUE_FULL','الدوري ممتلئ.','The league is full.'),
    ('ERROR','حدث خطأ. حاول مرة أخرى.','Something went wrong. Please try again.')]:
    s(f'errors.{k}', ar, en)

def build(idx):
    out = {}
    for key, vals in M.items():
        cur = out
        parts = key.split('.')
        for p in parts[:-1]:
            cur = cur.setdefault(p, {})
        cur[parts[-1]] = vals[idx]
    return out

base = sys.argv[1]
json.dump(build(0), open(f'{base}/ar.json', 'w'), ensure_ascii=False, indent=2)
json.dump(build(1), open(f'{base}/en.json', 'w'), ensure_ascii=False, indent=2)
print(len(M), 'keys')
