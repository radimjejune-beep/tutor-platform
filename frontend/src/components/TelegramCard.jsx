// components/TelegramCard.jsx — подключение итогов уроков в Telegram (ученик/родитель)
import { api } from '../api';
import { useLoad, Icon, useToast } from '../ui';
import { useAuth } from '../auth';

export default function TelegramCard({ style }) {
  const toast = useToast();
  const { user } = useAuth();
  const tutor = user?.role === 'tutor';
  const st = useLoad(() => api.telegramStatus(), []);
  if (!st.data?.enabled) return null;

  const connect = async () => {
    // Открываем окно сразу, иначе браузер заблокирует его как всплывающее
    const win = window.open('', '_blank');
    try {
      const { url } = await api.telegramLink();
      if (win) win.location.href = url;
      else window.location.href = url;
      toast('Нажмите «Старт» в Telegram, затем вернитесь сюда');
      setTimeout(() => st.reload(), 8000);
    } catch (err) {
      win?.close();
      toast(err.message, 'error');
    }
  };
  const disconnect = async () => {
    if (!window.confirm('Отключить уведомления в Telegram?')) return;
    await api.telegramUnlink();
    st.reload();
  };

  return (
    <section className="panel tg-card" style={style || { marginTop: 20 }}>
      <div className="assign-icon"><Icon name="send" /></div>
      <div className="list-main">
        <div className="list-title">{st.data.linked ? 'Уведомления приходят в Telegram' : tutor ? 'Уведомления себе в Telegram' : 'Уведомления в Telegram'}</div>
        <div className="list-sub">
          {tutor
            ? 'Сданные задания, записи на урок, заявки и отмены. Команда /today покажет уроки на сегодня'
            : st.data.linked
              ? 'Итоги уроков, новые задания и напоминания. Команды в боте: /lessons, /homework, /words'
              : 'Итоги уроков, новые задания, напоминание об уроке и о словах на повторение. Подключение в два нажатия'}
        </div>
      </div>
      {st.data.linked ? (
        <button className="btn btn-quiet btn-sm" onClick={disconnect}>Отключить</button>
      ) : (
        <button className="btn btn-sm" onClick={connect}>Подключить</button>
      )}
    </section>
  );
}
