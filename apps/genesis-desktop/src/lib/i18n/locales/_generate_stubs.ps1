$localesDir = "C:\Users\admin\Downloads\Genesis\apps\genesis-desktop\src\lib\i18n\locales"

$stubs = @{
  "fr" = @{
    "commonSave"="Enregistrer";"commonCancel"="Annuler";"commonClose"="Fermer";"commonDone"="Terminé"
    "commonSearch"="Rechercher";"commonBack"="Retour";"commonDelete"="Supprimer";"commonCreate"="Créer"
    "commonAdd"="Ajouter";"commonEdit"="Modifier";"commonSettings"="Paramètres";"commonSignOut"="Déconnexion"
    "commonSignIn"="Connexion";"commonLoading"="Chargement…";"commonError"="Erreur";"commonOn"="Activé";"commonOff"="Désactivé"
    "settingsTitle"="Paramètres";"settingsSectionLanguage"="Langue et région"
    "settingsLanguageTitle"="Langue et région";"settingsLanguageSearchPlaceholder"="Rechercher des langues…"
    "settingsLanguageDateFormat"="Format de date";"settingsLanguageTimeFormat"="Format d'heure"
    "settingsLanguageFirstDay"="Premier jour de la semaine";"day1"="Lundi";"day7"="Dimanche"
  }
  "es" = @{
    "commonSave"="Guardar";"commonCancel"="Cancelar";"commonClose"="Cerrar";"commonDone"="Hecho"
    "commonSearch"="Buscar";"commonBack"="Atrás";"commonDelete"="Eliminar";"commonCreate"="Crear"
    "commonAdd"="Añadir";"commonEdit"="Editar";"commonSettings"="Ajustes";"commonSignOut"="Cerrar sesión"
    "commonSignIn"="Iniciar sesión";"commonLoading"="Cargando…";"commonError"="Error";"commonOn"="Activado";"commonOff"="Desactivado"
    "settingsTitle"="Ajustes";"settingsSectionLanguage"="Idioma y región"
    "settingsLanguageTitle"="Idioma y región";"settingsLanguageSearchPlaceholder"="Buscar idiomas…"
    "settingsLanguageDateFormat"="Formato de fecha";"settingsLanguageTimeFormat"="Formato de hora"
    "settingsLanguageFirstDay"="Primer día de la semana";"day1"="Lunes";"day7"="Domingo"
  }
  "ru" = @{
    "commonSave"="Сохранить";"commonCancel"="Отмена";"commonClose"="Закрыть";"commonDone"="Готово"
    "commonSearch"="Поиск";"commonBack"="Назад";"commonDelete"="Удалить";"commonCreate"="Создать"
    "commonAdd"="Добавить";"commonEdit"="Изменить";"commonSettings"="Настройки";"commonSignOut"="Выйти"
    "commonSignIn"="Войти";"commonLoading"="Загрузка…";"commonError"="Ошибка";"commonOn"="Вкл";"commonOff"="Выкл"
    "settingsTitle"="Настройки";"settingsSectionLanguage"="Язык и регион"
    "settingsLanguageTitle"="Язык и регион";"settingsLanguageSearchPlaceholder"="Поиск языков…"
    "settingsLanguageDateFormat"="Формат даты";"settingsLanguageTimeFormat"="Формат времени"
    "settingsLanguageFirstDay"="Первый день недели";"day1"="Понедельник";"day7"="Воскресенье"
  }
  "zh-CN" = @{
    "commonSave"="保存";"commonCancel"="取消";"commonClose"="关闭";"commonDone"="完成"
    "commonSearch"="搜索";"commonBack"="返回";"commonDelete"="删除";"commonCreate"="创建"
    "commonAdd"="添加";"commonEdit"="编辑";"commonSettings"="设置";"commonSignOut"="退出登录"
    "commonSignIn"="登录";"commonLoading"="加载中…";"commonError"="错误";"commonOn"="开";"commonOff"="关"
    "settingsTitle"="设置";"settingsSectionLanguage"="语言与地区"
    "settingsLanguageTitle"="语言与地区";"settingsLanguageSearchPlaceholder"="搜索语言…"
    "settingsLanguageDateFormat"="日期格式";"settingsLanguageTimeFormat"="时间格式"
    "settingsLanguageFirstDay"="每周第一天";"day1"="星期一";"day7"="星期日"
  }
  "zh-TW" = @{
    "commonSave"="儲存";"commonCancel"="取消";"commonClose"="關閉";"commonDone"="完成"
    "commonSearch"="搜尋";"commonBack"="返回";"commonDelete"="刪除";"commonCreate"="建立"
    "commonAdd"="新增";"commonEdit"="編輯";"commonSettings"="設定";"commonSignOut"="登出"
    "commonSignIn"="登入";"commonLoading"="載入中…";"commonError"="錯誤";"commonOn"="開";"commonOff"="關"
    "settingsTitle"="設定";"settingsSectionLanguage"="語言與地區"
    "settingsLanguageTitle"="語言與地區";"settingsLanguageSearchPlaceholder"="搜尋語言…"
    "settingsLanguageDateFormat"="日期格式";"settingsLanguageTimeFormat"="時間格式"
    "settingsLanguageFirstDay"="每週第一天";"day1"="星期一";"day7"="星期日"
  }
  "ja" = @{
    "commonSave"="保存";"commonCancel"="キャンセル";"commonClose"="閉じる";"commonDone"="完了"
    "commonSearch"="検索";"commonBack"="戻る";"commonDelete"="削除";"commonCreate"="作成"
    "commonAdd"="追加";"commonEdit"="編集";"commonSettings"="設定";"commonSignOut"="サインアウト"
    "commonSignIn"="サインイン";"commonLoading"="読込中…";"commonError"="エラー";"commonOn"="オン";"commonOff"="オフ"
    "settingsTitle"="設定";"settingsSectionLanguage"="言語と地域"
    "settingsLanguageTitle"="言語と地域";"settingsLanguageSearchPlaceholder"="言語を検索…"
    "settingsLanguageDateFormat"="日付形式";"settingsLanguageTimeFormat"="時刻形式"
    "settingsLanguageFirstDay"="週の最初の曜日";"day1"="月曜日";"day7"="日曜日"
  }
  "ko" = @{
    "commonSave"="저장";"commonCancel"="취소";"commonClose"="닫기";"commonDone"="완료"
    "commonSearch"="검색";"commonBack"="뒤로";"commonDelete"="삭제";"commonCreate"="만들기"
    "commonAdd"="추가";"commonEdit"="편집";"commonSettings"="설정";"commonSignOut"="로그아웃"
    "commonSignIn"="로그인";"commonLoading"="로드 중…";"commonError"="오류";"commonOn"="켜기";"commonOff"="끄기"
    "settingsTitle"="설정";"settingsSectionLanguage"="언어 및 지역"
    "settingsLanguageTitle"="언어 및 지역";"settingsLanguageSearchPlaceholder"="언어 검색…"
    "settingsLanguageDateFormat"="날짜 형식";"settingsLanguageTimeFormat"="시간 형식"
    "settingsLanguageFirstDay"="주 시작 요일";"day1"="월요일";"day7"="일요일"
  }
  "pt-BR" = @{
    "commonSave"="Salvar";"commonCancel"="Cancelar";"commonClose"="Fechar";"commonDone"="Pronto"
    "commonSearch"="Pesquisar";"commonBack"="Voltar";"commonDelete"="Excluir";"commonCreate"="Criar"
    "commonAdd"="Adicionar";"commonEdit"="Editar";"commonSettings"="Configurações";"commonSignOut"="Sair"
    "commonSignIn"="Entrar";"commonLoading"="Carregando…";"commonError"="Erro";"commonOn"="Ativado";"commonOff"="Desativado"
    "settingsTitle"="Configurações";"settingsSectionLanguage"="Idioma e região"
    "settingsLanguageTitle"="Idioma e região";"settingsLanguageSearchPlaceholder"="Pesquisar idiomas…"
    "settingsLanguageDateFormat"="Formato de data";"settingsLanguageTimeFormat"="Formato de hora"
    "settingsLanguageFirstDay"="Primeiro dia da semana";"day1"="Segunda-feira";"day7"="Domingo"
  }
  "pt-PT" = @{
    "commonSave"="Guardar";"commonCancel"="Cancelar";"commonClose"="Fechar";"commonDone"="Concluído"
    "commonSearch"="Pesquisar";"commonBack"="Voltar";"commonDelete"="Eliminar";"commonCreate"="Criar"
    "commonAdd"="Adicionar";"commonEdit"="Editar";"commonSettings"="Definições";"commonSignOut"="Terminar sessão"
    "commonSignIn"="Iniciar sessão";"commonLoading"="A carregar…";"commonError"="Erro";"commonOn"="Ligado";"commonOff"="Desligado"
    "settingsTitle"="Definições";"settingsSectionLanguage"="Idioma e região"
    "settingsLanguageTitle"="Idioma e região";"settingsLanguageSearchPlaceholder"="Pesquisar idiomas…"
    "settingsLanguageDateFormat"="Formato de data";"settingsLanguageTimeFormat"="Formato de hora"
    "settingsLanguageFirstDay"="Primeiro dia da semana";"day1"="Segunda-feira";"day7"="Domingo"
  }
  "it" = @{
    "commonSave"="Salva";"commonCancel"="Annulla";"commonClose"="Chiudi";"commonDone"="Fatto"
    "commonSearch"="Cerca";"commonBack"="Indietro";"commonDelete"="Elimina";"commonCreate"="Crea"
    "commonAdd"="Aggiungi";"commonEdit"="Modifica";"commonSettings"="Impostazioni";"commonSignOut"="Esci"
    "commonSignIn"="Accedi";"commonLoading"="Caricamento…";"commonError"="Errore";"commonOn"="Attivo";"commonOff"="Disattivo"
    "settingsTitle"="Impostazioni";"settingsSectionLanguage"="Lingua e regione"
    "settingsLanguageTitle"="Lingua e regione";"settingsLanguageSearchPlaceholder"="Cerca lingue…"
    "settingsLanguageDateFormat"="Formato data";"settingsLanguageTimeFormat"="Formato ora"
    "settingsLanguageFirstDay"="Primo giorno della settimana";"day1"="Lunedì";"day7"="Domenica"
  }
  "pl" = @{
    "commonSave"="Zapisz";"commonCancel"="Anuluj";"commonClose"="Zamknij";"commonDone"="Gotowe"
    "commonSearch"="Szukaj";"commonBack"="Wstecz";"commonDelete"="Usuń";"commonCreate"="Utwórz"
    "commonAdd"="Dodaj";"commonEdit"="Edytuj";"commonSettings"="Ustawienia";"commonSignOut"="Wyloguj"
    "commonSignIn"="Zaloguj";"commonLoading"="Ładowanie…";"commonError"="Błąd";"commonOn"="Wł";"commonOff"="Wył"
    "settingsTitle"="Ustawienia";"settingsSectionLanguage"="Język i region"
    "settingsLanguageTitle"="Język i region";"settingsLanguageSearchPlaceholder"="Szukaj języków…"
    "settingsLanguageDateFormat"="Format daty";"settingsLanguageTimeFormat"="Format czasu"
    "settingsLanguageFirstDay"="Pierwszy dzień tygodnia";"day1"="Poniedziałek";"day7"="Niedziela"
  }
  "tr" = @{
    "commonSave"="Kaydet";"commonCancel"="İptal";"commonClose"="Kapat";"commonDone"="Tamam"
    "commonSearch"="Ara";"commonBack"="Geri";"commonDelete"="Sil";"commonCreate"="Oluştur"
    "commonAdd"="Ekle";"commonEdit"="Düzenle";"commonSettings"="Ayarlar";"commonSignOut"="Çıkış Yap"
    "commonSignIn"="Giriş Yap";"commonLoading"="Yükleniyor…";"commonError"="Hata";"commonOn"="Açık";"commonOff"="Kapalı"
    "settingsTitle"="Ayarlar";"settingsSectionLanguage"="Dil ve Bölge"
    "settingsLanguageTitle"="Dil ve Bölge";"settingsLanguageSearchPlaceholder"="Dil ara…"
    "settingsLanguageDateFormat"="Tarih formatı";"settingsLanguageTimeFormat"="Saat formatı"
    "settingsLanguageFirstDay"="Haftanın ilk günü";"day1"="Pazartesi";"day7"="Pazar"
  }
  "uk" = @{
    "commonSave"="Зберегти";"commonCancel"="Скасувати";"commonClose"="Закрити";"commonDone"="Готово"
    "commonSearch"="Пошук";"commonBack"="Назад";"commonDelete"="Видалити";"commonCreate"="Створити"
    "commonAdd"="Додати";"commonEdit"="Редагувати";"commonSettings"="Налаштування";"commonSignOut"="Вийти"
    "commonSignIn"="Увійти";"commonLoading"="Завантаження…";"commonError"="Помилка";"commonOn"="Увімк";"commonOff"="Вимк"
    "settingsTitle"="Налаштування";"settingsSectionLanguage"="Мова і регіон"
    "settingsLanguageTitle"="Мова і регіон";"settingsLanguageSearchPlaceholder"="Пошук мов…"
    "settingsLanguageDateFormat"="Формат дати";"settingsLanguageTimeFormat"="Формат часу"
    "settingsLanguageFirstDay"="Перший день тижня";"day1"="Понеділок";"day7"="Неділя"
  }
  "nl" = @{
    "commonSave"="Opslaan";"commonCancel"="Annuleren";"commonClose"="Sluiten";"commonDone"="Klaar"
    "commonSearch"="Zoeken";"commonBack"="Terug";"commonDelete"="Verwijderen";"commonCreate"="Aanmaken"
    "commonAdd"="Toevoegen";"commonEdit"="Bewerken";"commonSettings"="Instellingen";"commonSignOut"="Uitloggen"
    "commonSignIn"="Inloggen";"commonLoading"="Laden…";"commonError"="Fout";"commonOn"="Aan";"commonOff"="Uit"
    "settingsTitle"="Instellingen";"settingsSectionLanguage"="Taal en regio"
    "settingsLanguageTitle"="Taal en regio";"settingsLanguageSearchPlaceholder"="Talen zoeken…"
    "settingsLanguageDateFormat"="Datumnotatie";"settingsLanguageTimeFormat"="Tijdnotatie"
    "settingsLanguageFirstDay"="Eerste dag van de week";"day1"="Maandag";"day7"="Zondag"
  }
  "hi" = @{
    "commonSave"="सहेजें";"commonCancel"="रद्द करें";"commonClose"="बंद करें";"commonDone"="हो गया"
    "commonSearch"="खोजें";"commonBack"="वापस";"commonDelete"="हटाएं";"commonCreate"="बनाएं"
    "commonAdd"="जोड़ें";"commonEdit"="संपादित करें";"commonSettings"="सेटिंग";"commonSignOut"="साइन आउट"
    "commonSignIn"="साइन इन";"commonLoading"="लोड हो रहा है…";"commonError"="त्रुटि";"commonOn"="चालू";"commonOff"="बंद"
    "settingsTitle"="सेटिंग";"settingsSectionLanguage"="भाषा और क्षेत्र"
    "settingsLanguageTitle"="भाषा और क्षेत्र";"settingsLanguageSearchPlaceholder"="भाषाएं खोजें…"
    "settingsLanguageDateFormat"="तारीख का प्रारूप";"settingsLanguageTimeFormat"="समय का प्रारूप"
    "settingsLanguageFirstDay"="सप्ताह का पहला दिन";"day1"="सोमवार";"day7"="रविवार"
  }
  "ar" = @{
    "commonSave"="حفظ";"commonCancel"="إلغاء";"commonClose"="إغلاق";"commonDone"="تم"
    "commonSearch"="بحث";"commonBack"="رجوع";"commonDelete"="حذف";"commonCreate"="إنشاء"
    "commonAdd"="إضافة";"commonEdit"="تعديل";"commonSettings"="الإعدادات";"commonSignOut"="تسجيل الخروج"
    "commonSignIn"="تسجيل الدخول";"commonLoading"="جارٍ التحميل…";"commonError"="خطأ";"commonOn"="تشغيل";"commonOff"="إيقاف"
    "settingsTitle"="الإعدادات";"settingsSectionLanguage"="اللغة والمنطقة"
    "settingsLanguageTitle"="اللغة والمنطقة";"settingsLanguageSearchPlaceholder"="ابحث عن اللغات…"
    "settingsLanguageDateFormat"="تنسيق التاريخ";"settingsLanguageTimeFormat"="تنسيق الوقت"
    "settingsLanguageFirstDay"="أول يوم في الأسبوع";"day1"="الاثنين";"day7"="الأحد"
  }
  "fa" = @{
    "commonSave"="ذخیره";"commonCancel"="لغو";"commonClose"="بستن";"commonDone"="انجام شد"
    "commonSearch"="جستجو";"commonBack"="بازگشت";"commonDelete"="حذف";"commonCreate"="ایجاد"
    "commonAdd"="افزودن";"commonEdit"="ویرایش";"commonSettings"="تنظیمات";"commonSignOut"="خروج"
    "commonSignIn"="ورود";"commonLoading"="در حال بارگذاری…";"commonError"="خطا";"commonOn"="روشن";"commonOff"="خاموش"
    "settingsTitle"="تنظیمات";"settingsSectionLanguage"="زبان و منطقه"
    "settingsLanguageTitle"="زبان و منطقه";"settingsLanguageSearchPlaceholder"="جستجوی زبان…"
    "settingsLanguageDateFormat"="قالب تاریخ";"settingsLanguageTimeFormat"="قالب زمان"
    "settingsLanguageFirstDay"="اولین روز هفته";"day1"="دوشنبه";"day7"="یکشنبه"
  }
  "id" = @{
    "commonSave"="Simpan";"commonCancel"="Batal";"commonClose"="Tutup";"commonDone"="Selesai"
    "commonSearch"="Cari";"commonBack"="Kembali";"commonDelete"="Hapus";"commonCreate"="Buat"
    "commonAdd"="Tambah";"commonEdit"="Edit";"commonSettings"="Pengaturan";"commonSignOut"="Keluar"
    "commonSignIn"="Masuk";"commonLoading"="Memuat…";"commonError"="Kesalahan";"commonOn"="Aktif";"commonOff"="Nonaktif"
    "settingsTitle"="Pengaturan";"settingsSectionLanguage"="Bahasa dan Wilayah"
    "settingsLanguageTitle"="Bahasa dan Wilayah";"settingsLanguageSearchPlaceholder"="Cari bahasa…"
    "settingsLanguageDateFormat"="Format tanggal";"settingsLanguageTimeFormat"="Format waktu"
    "settingsLanguageFirstDay"="Hari pertama dalam seminggu";"day1"="Senin";"day7"="Minggu"
  }
  "vi" = @{
    "commonSave"="Lưu";"commonCancel"="Hủy";"commonClose"="Đóng";"commonDone"="Xong"
    "commonSearch"="Tìm kiếm";"commonBack"="Quay lại";"commonDelete"="Xóa";"commonCreate"="Tạo"
    "commonAdd"="Thêm";"commonEdit"="Chỉnh sửa";"commonSettings"="Cài đặt";"commonSignOut"="Đăng xuất"
    "commonSignIn"="Đăng nhập";"commonLoading"="Đang tải…";"commonError"="Lỗi";"commonOn"="Bật";"commonOff"="Tắt"
    "settingsTitle"="Cài đặt";"settingsSectionLanguage"="Ngôn ngữ và khu vực"
    "settingsLanguageTitle"="Ngôn ngữ và khu vực";"settingsLanguageSearchPlaceholder"="Tìm kiếm ngôn ngữ…"
    "settingsLanguageDateFormat"="Định dạng ngày";"settingsLanguageTimeFormat"="Định dạng giờ"
    "settingsLanguageFirstDay"="Ngày đầu tuần";"day1"="Thứ Hai";"day7"="Chủ Nhật"
  }
  "cs" = @{
    "commonSave"="Uložit";"commonCancel"="Zrušit";"commonClose"="Zavřít";"commonDone"="Hotovo"
    "commonSearch"="Hledat";"commonBack"="Zpět";"commonDelete"="Smazat";"commonCreate"="Vytvořit"
    "commonAdd"="Přidat";"commonEdit"="Upravit";"commonSettings"="Nastavení";"commonSignOut"="Odhlásit se"
    "commonSignIn"="Přihlásit se";"commonLoading"="Načítání…";"commonError"="Chyba";"commonOn"="Zap";"commonOff"="Vyp"
    "settingsTitle"="Nastavení";"settingsSectionLanguage"="Jazyk a region"
    "settingsLanguageTitle"="Jazyk a region";"settingsLanguageSearchPlaceholder"="Hledat jazyky…"
    "settingsLanguageDateFormat"="Formát data";"settingsLanguageTimeFormat"="Formát času"
    "settingsLanguageFirstDay"="První den týdne";"day1"="Pondělí";"day7"="Neděle"
  }
  "da" = @{
    "commonSave"="Gem";"commonCancel"="Annuller";"commonClose"="Luk";"commonDone"="Færdig"
    "commonSearch"="Søg";"commonBack"="Tilbage";"commonDelete"="Slet";"commonCreate"="Opret"
    "commonAdd"="Tilføj";"commonEdit"="Rediger";"commonSettings"="Indstillinger";"commonSignOut"="Log ud"
    "commonSignIn"="Log ind";"commonLoading"="Indlæser…";"commonError"="Fejl";"commonOn"="Til";"commonOff"="Fra"
    "settingsTitle"="Indstillinger";"settingsSectionLanguage"="Sprog og region"
    "settingsLanguageTitle"="Sprog og region";"settingsLanguageSearchPlaceholder"="Søg efter sprog…"
    "settingsLanguageDateFormat"="Datoformat";"settingsLanguageTimeFormat"="Tidsformat"
    "settingsLanguageFirstDay"="Ugens første dag";"day1"="Mandag";"day7"="Søndag"
  }
  "no" = @{
    "commonSave"="Lagre";"commonCancel"="Avbryt";"commonClose"="Lukk";"commonDone"="Ferdig"
    "commonSearch"="Søk";"commonBack"="Tilbake";"commonDelete"="Slett";"commonCreate"="Opprett"
    "commonAdd"="Legg til";"commonEdit"="Rediger";"commonSettings"="Innstillinger";"commonSignOut"="Logg ut"
    "commonSignIn"="Logg inn";"commonLoading"="Laster…";"commonError"="Feil";"commonOn"="På";"commonOff"="Av"
    "settingsTitle"="Innstillinger";"settingsSectionLanguage"="Språk og region"
    "settingsLanguageTitle"="Språk og region";"settingsLanguageSearchPlaceholder"="Søk etter språk…"
    "settingsLanguageDateFormat"="Datoformat";"settingsLanguageTimeFormat"="Tidsformat"
    "settingsLanguageFirstDay"="Ukens første dag";"day1"="Mandag";"day7"="Søndag"
  }
  "ro" = @{
    "commonSave"="Salvare";"commonCancel"="Anulare";"commonClose"="Închide";"commonDone"="Gata"
    "commonSearch"="Căutare";"commonBack"="Înapoi";"commonDelete"="Ștergere";"commonCreate"="Creare"
    "commonAdd"="Adăugare";"commonEdit"="Editare";"commonSettings"="Setări";"commonSignOut"="Deconectare"
    "commonSignIn"="Conectare";"commonLoading"="Se încarcă…";"commonError"="Eroare";"commonOn"="Pornit";"commonOff"="Oprit"
    "settingsTitle"="Setări";"settingsSectionLanguage"="Limbă și regiune"
    "settingsLanguageTitle"="Limbă și regiune";"settingsLanguageSearchPlaceholder"="Caută limbi…"
    "settingsLanguageDateFormat"="Format dată";"settingsLanguageTimeFormat"="Format oră"
    "settingsLanguageFirstDay"="Prima zi a săptămânii";"day1"="Luni";"day7"="Duminică"
  }
  "lt" = @{
    "commonSave"="Išsaugoti";"commonCancel"="Atšaukti";"commonClose"="Uždaryti";"commonDone"="Atlikta"
    "commonSearch"="Ieškoti";"commonBack"="Atgal";"commonDelete"="Ištrinti";"commonCreate"="Kurti"
    "commonAdd"="Pridėti";"commonEdit"="Redaguoti";"commonSettings"="Nustatymai";"commonSignOut"="Atsijungti"
    "commonSignIn"="Prisijungti";"commonLoading"="Kraunama…";"commonError"="Klaida";"commonOn"="Įj";"commonOff"="Išj"
    "settingsTitle"="Nustatymai";"settingsSectionLanguage"="Kalba ir regionas"
    "settingsLanguageTitle"="Kalba ir regionas";"settingsLanguageSearchPlaceholder"="Ieškoti kalbų…"
    "settingsLanguageDateFormat"="Datos formatas";"settingsLanguageTimeFormat"="Laiko formatas"
    "settingsLanguageFirstDay"="Pirma savaitės diena";"day1"="Pirmadienis";"day7"="Sekmadienis"
  }
  "be" = @{
    "commonSave"="Захаваць";"commonCancel"="Скасаваць";"commonClose"="Зачыніць";"commonDone"="Гатова"
    "commonSearch"="Пошук";"commonBack"="Назад";"commonDelete"="Выдаліць";"commonCreate"="Стварыць"
    "commonAdd"="Дадаць";"commonEdit"="Рэдагаваць";"commonSettings"="Налады";"commonSignOut"="Выйсці"
    "commonSignIn"="Увайсці";"commonLoading"="Загрузка…";"commonError"="Памылка";"commonOn"="Увкл";"commonOff"="Выкл"
    "settingsTitle"="Налады";"settingsSectionLanguage"="Мова і рэгіён"
    "settingsLanguageTitle"="Мова і рэгіён";"settingsLanguageSearchPlaceholder"="Пошук моў…"
    "settingsLanguageDateFormat"="Фармат даты";"settingsLanguageTimeFormat"="Фармат часу"
    "settingsLanguageFirstDay"="Першы дзень тыдня";"day1"="Панядзелак";"day7"="Нядзеля"
  }
}

foreach ($code in $stubs.Keys) {
    $path = Join-Path $localesDir "$code.json"
    $stubs[$code] | ConvertTo-Json -Depth 3 | Set-Content -Path $path -Encoding UTF8
    Write-Host "Written: $path"
}
Write-Host "All locale stubs created."
