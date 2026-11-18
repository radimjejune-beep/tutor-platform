// pages/CoursePage.jsx — страница отдельного курса
import { useState, useEffect } from 'react';
import { useAuth } from '../auth';
import { api } from '../api';
import { Icon, Link, Spinner, navigate, useRoute } from '../ui';
import { BackLink } from '../Shell';

export default function CoursePage({ slug }) {
  const { user } = useAuth();
  const [course, setCourse] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [selectedModule, setSelectedModule] = useState(0);

  useEffect(() => {
    loadCourse();
  }, [slug]);

  const loadCourse = async () => {
    setLoading(true);
    try {
      const data = await api.get(`/marketplace/courses/${slug}`);
      setCourse(data.course);
      setReviews(data.reviews);
    } catch (error) {
      console.error('Failed to load course:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async () => {
    if (!user) {
      navigate('/login');
      return;
    }

    setPurchasing(true);
    try {
      // Создаем Stripe checkout session
      const data = await api.post('/payments/create-checkout-session', {
        course_id: course.id,
        success_url: `${window.location.origin}/#/courses/${slug}?purchase=success`,
        cancel_url: `${window.location.origin}/#/courses/${slug}`
      });

      // Перенаправляем на Stripe
      window.location.href = data.checkout_url;
    } catch (error) {
      console.error('Purchase failed:', error);
      alert(error.message || 'Не удалось создать платёж');
      setPurchasing(false);
    }
  };

  const formatPrice = (amount, currency) => {
    if (amount === 0) return 'Бесплатно';
    const formatted = (amount / 100).toFixed(2);
    const symbol = currency === 'USD' ? '$' : currency === 'RUB' ? '₽' : currency;
    return `${symbol}${formatted}`;
  };

  if (loading) return <Spinner />;
  if (!course) return <div className="panel">Курс не найден</div>;

  const modules = JSON.parse(course.modules || '[]');

  return (
    <>
      <BackLink to="/marketplace">Маркетплейс курсов</BackLink>

      <div className="course-page">
        {/* Header */}
        <div className="course-header">
          {course.thumbnail_url && (
            <div
              className="course-header-thumb"
              style={{ backgroundImage: `url(${course.thumbnail_url})` }}
            />
          )}

          <div className="course-header-content">
            <div className="row" style={{ gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
              {course.category && (
                <span className="badge">{course.category}</span>
              )}
              {course.level && (
                <span className="badge">{course.level}</span>
              )}
            </div>

            <h1 className="course-header-title">{course.title}</h1>

            <p className="course-header-author">
              <Icon name="user" size={16} />
              <Link to={`/tutors/${course.author_login}`}>{course.author_name}</Link>
            </p>

            {course.description && (
              <p className="course-header-desc">{course.description}</p>
            )}

            <div className="course-header-stats row" style={{ gap: 24 }}>
              {course.rating > 0 && (
                <div>
                  <span className="stat-value">⭐ {course.rating.toFixed(1)}</span>
                  <span className="stat-label small muted">
                    {course.reviews_count} отзывов
                  </span>
                </div>
              )}
              {course.total_lessons > 0 && (
                <div>
                  <span className="stat-value">{course.total_lessons}</span>
                  <span className="stat-label small muted">уроков</span>
                </div>
              )}
              {course.estimated_hours && (
                <div>
                  <span className="stat-value">{course.estimated_hours}ч</span>
                  <span className="stat-label small muted">обучения</span>
                </div>
              )}
              {course.total_sales > 0 && (
                <div>
                  <span className="stat-value">{course.total_sales}</span>
                  <span className="stat-label small muted">учеников</span>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar with purchase */}
          <div className="course-sidebar-card">
            <div className="course-price">
              {formatPrice(course.price_amount, course.currency)}
            </div>

            {course.is_purchased ? (
              <div>
                <button className="btn btn-primary" style={{ width: '100%' }}>
                  <Icon name="play" size={18} /> Перейти к курсу
                </button>
                <p className="small muted" style={{ marginTop: 8, textAlign: 'center' }}>
                  У вас есть доступ к этому курсу
                </p>
              </div>
            ) : (
              <div>
                <button
                  className="btn btn-primary"
                  style={{ width: '100%' }}
                  onClick={handlePurchase}
                  disabled={purchasing}
                >
                  {purchasing ? (
                    <>Обработка...</>
                  ) : course.price_type === 'free' ? (
                    <>Получить доступ</>
                  ) : (
                    <>Купить курс</>
                  )}
                </button>

                {course.price_type !== 'free' && (
                  <p className="small muted" style={{ marginTop: 12 }}>
                    • Пожизненный доступ<br />
                    • Все обновления бесплатно<br />
                    • Возврат в течение 14 дней
                  </p>
                )}
              </div>
            )}

            <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--line)' }}>
              <p className="small muted">
                <Icon name="users" size={14} /> {course.favorites_count || 0} в избранном
              </p>
            </div>
          </div>
        </div>

        {/* Modules */}
        <div className="course-content">
          <h2 className="section-title" style={{ marginBottom: 16 }}>Программа курса</h2>

          <div className="course-modules">
            {modules.map((module, i) => (
              <div key={i} className="panel course-module">
                <button
                  className="course-module-head"
                  onClick={() => setSelectedModule(selectedModule === i ? -1 : i)}
                >
                  <h3 className="course-module-title">
                    {i + 1}. {module.title}
                  </h3>
                  <Icon
                    name={selectedModule === i ? 'chevron-down' : 'chevron-right'}
                    size={18}
                  />
                </button>

                {selectedModule === i && (
                  <div className="course-module-body">
                    {module.description && (
                      <p className="muted" style={{ marginBottom: 16 }}>
                        {module.description}
                      </p>
                    )}

                    <div className="course-units">
                      {module.units.map((unit, j) => (
                        <div key={j} className="course-unit">
                          <Icon
                            name={
                              unit.type === 'video' ? 'play' :
                              unit.type === 'quiz' ? 'quiz' :
                              unit.type === 'assignment' ? 'book' :
                              'file'
                            }
                            size={16}
                          />
                          <span>{unit.title}</span>
                          {unit.duration && (
                            <span className="small muted">{unit.duration} мин</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Reviews */}
        {reviews.length > 0 && (
          <div className="course-reviews">
            <h2 className="section-title" style={{ marginBottom: 16 }}>Отзывы</h2>

            <div className="reviews-list">
              {reviews.map(review => (
                <div key={review.id} className="panel review">
                  <div className="review-head">
                    <div>
                      <div className="review-author">{review.user_name}</div>
                      <div className="review-rating">
                        {'⭐'.repeat(review.rating)}
                      </div>
                    </div>
                    <div className="small muted">
                      {new Date(review.created_at).toLocaleDateString('ru-RU')}
                    </div>
                  </div>

                  {review.title && (
                    <div className="review-title">{review.title}</div>
                  )}

                  {review.content && (
                    <p className="review-content">{review.content}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
