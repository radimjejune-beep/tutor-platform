// components/TelegramCard.jsx — подключение итогов уроков в Telegram (ученик/родитель)
import { api } from '../api';
import { useLoad, Icon, useToast } from '../ui';

export default function TelegramCard() {
  const toast = useToast();
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
    if (!window.confirm('Отключить итоги уроков в Telegram?')) return;
    await api.telegramUnlink();
    st.reload();
  };

  return (
    <section className="panel tg-card" style={{ marginTop: 20 }}>
      <div className="assign-icon" style={{ background: '#2a9fd8' }}><Icon name="send" /></div>
      <div className="list-main">
        <div className="list-title">{st.data.linked ? 'Итоги уроков приходят в Telegram' : 'Получайте итоги уроков в Telegram'}</div>
        <div className="list-sub">
          {st.data.linked ? 'После каждого урока — что прошли и какое домашнее задание' : 'Бот пришлёт, что прошли на уроке и что задано. Подключение в два нажатия'}
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
