// pages/tutor/MyCoursesAuthor.jsx — управление курсами автора
import { useState, useEffect } from 'react';
import { api } from '../../api';
import { Icon, Link, Spinner, navigate } from '../../ui';
import { BackLink } from '../../Shell';

export default function MyCoursesAuthor() {
  const [courses, setCourses] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [coursesData, statsData] = await Promise.all([
        api.get('/marketplace/author/courses'),
        api.get('/marketplace/author/stats')
      ]);
      setCourses(coursesData.courses);
      setStats(statsData.stats);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (amount, currency = 'USD') => {
    const formatted = (amount / 100).toFixed(2);
    const symbol = currency === 'USD' ? '$' : currency === 'RUB' ? '₽' : currency;
    return `${symbol}${formatted}`;
  };

  if (loading) return <Spinner />;

  return (
    <>
      <BackLink to="/marketplace">Маркетплейс</BackLink>
      <div className="page-head">
        <h1 className="page-title">Мои курсы</h1>
        <Link to="/marketplace/create" className="btn btn-primary">
          <Icon name="plus" size={18} /> Создать курс
        </Link>
      </div>

      {/* Статистика */}
      {stats && (
        <div className="grid-3" style={{ marginBottom: 32 }}>
          <div className="panel stat-card">
            <div className="stat-value">{stats.total_courses || 0}</div>
            <div className="stat-label">Курсов создано</div>
          </div>

          <div className="panel stat-card">
            <div className="stat-value">{stats.total_sales || 0}</div>
            <div className="stat-label">Всего продаж</div>
          </div>

          <div className="panel stat-card">
            <div className="stat-value">
              {formatPrice(stats.total_revenue || 0)}
            </div>
            <div className="stat-label">Общий доход</div>
          </div>

          <div className="panel stat-card">
            <div className="stat-value">
              ⭐ {stats.avg_rating ? stats.avg_rating.toFixed(1) : '—'}
            </div>
            <div className="stat-label">Средний рейтинг</div>
          </div>

          <div className="panel stat-card">
            <div className="stat-value">
              {formatPrice(stats.total_payouts || 0)}
            </div>
            <div className="stat-label">Выплачено</div>
          </div>
        </div>
      )}

      {/* Список курсов */}
      {courses.length === 0 ? (
        <div className="panel">
          <p className="muted">У вас пока нет созданных курсов.</p>
          <Link to="/marketplace/create" className="btn btn-primary" style={{ marginTop: 16 }}>
            <Icon name="plus" size={18} /> Создать первый курс
          </Link>
        </div>
      ) : (
        <div className="courses-author-list">
          {courses.map(course => (
            <div key={course.id} className="panel course-author-card">
              <div className="course-author-card-main">
                {course.thumbnail_url && (
                  <div
                    className="course-author-card-thumb"
                    style={{ backgroundImage: `url(${course.thumbnail_url})` }}
                  />
                )}

                <div className="course-author-card-info">
                  <h3 className="course-author-card-title">{course.title}</h3>

                  <div className="row" style={{ gap: 12, marginTop: 8 }}>
                    <span className={`badge badge-${course.status}`}>
                      {course.status === 'draft' && 'Черновик'}
                      {course.status === 'published' && 'Опубликован'}
                      {course.status === 'archived' && 'Архив'}
                    </span>

                    {course.price_type === 'free' && (
                      <span className="small muted">Бесплатный</span>
                    )}
                    {course.price_type === 'paid' && (
                      <span className="small">
                        {formatPrice(course.price_amount, course.currency)}
                      </span>
                    )}
                  </div>

                  {course.description && (
                    <p className="small muted" style={{ marginTop: 8 }}>
                      {course.description.substring(0, 150)}
                      {course.description.length > 150 && '...'}
                    </p>
                  )}
                </div>
              </div>

              <div className="course-author-card-stats">
                <div className="stat-mini">
                  <div className="stat-mini-value">{course.total_sales || 0}</div>
                  <div className="stat-mini-label">продаж</div>
                </div>

                <div className="stat-mini">
                  <div className="stat-mini-value">
                    {formatPrice(course.total_revenue || 0)}
                  </div>
                  <div className="stat-mini-label">доход</div>
                </div>

                <div className="stat-mini">
                  <div className="stat-mini-value">
                    {course.rating > 0 ? `⭐ ${course.rating.toFixed(1)}` : '—'}
                  </div>
                  <div className="stat-mini-label">{course.reviews_count || 0} отзывов</div>
                </div>
              </div>

              <div className="course-author-card-actions">
                <Link
                  to={`/marketplace/edit/${course.id}`}
                  className="btn btn-quiet btn-sm"
                >
                  <Icon name="edit" size={16} /> Редактировать
                </Link>

                {course.status === 'published' && (
                  <Link
                    to={`/courses/${course.slug}`}
                    className="btn btn-quiet btn-sm"
                  >
                    <Icon name="eye" size={16} /> Просмотр
                  </Link>
                )}

                {course.status === 'draft' && (
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={async () => {
                      try {
                        await api.post(`/marketplace/courses/${course.id}/publish`);
                        loadData();
                      } catch (error) {
                        alert('Не удалось опубликовать курс');
                      }
                    }}
                  >
                    Опубликовать
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
