// pages/CoursesMarketplace.jsx — маркетплейс курсов
import { useState, useEffect } from 'react';
import { api } from '../api';
import { Icon, Link, Spinner, navigate } from '../ui';
import { BackLink } from '../Shell';

export default function CoursesMarketplace() {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    category: '',
    level: '',
    price_type: '',
    search: '',
    sort: 'popular'
  });
  const [pagination, setPagination] = useState({ page: 1, total: 0, pages: 0 });

  useEffect(() => {
    loadCourses();
  }, [filters, pagination.page]);

  const loadCourses = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        ...filters,
        page: pagination.page,
        limit: 12
      });

      const data = await api.get(`/marketplace/courses?${params}`);
      setCourses(data.courses);
      setPagination(data.pagination);
    } catch (error) {
      console.error('Failed to load courses:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateFilter = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  return (
    <>
      <BackLink to="/">Главная</BackLink>
      <div className="page-head">
        <h1 className="page-title">Маркетплейс курсов</h1>
        <p className="muted">Готовые курсы от опытных преподавателей для ваших учеников</p>
      </div>

      {/* Фильтры */}
      <div className="panel" style={{ marginBottom: 24 }}>
        <div className="grid-3" style={{ gap: 16 }}>
          <div>
            <label className="label">Поиск</label>
            <input
              type="text"
              className="input"
              placeholder="Название курса..."
              value={filters.search}
              onChange={(e) => updateFilter('search', e.target.value)}
            />
          </div>

          <div>
            <label className="label">Категория</label>
            <select
              className="input"
              value={filters.category}
              onChange={(e) => updateFilter('category', e.target.value)}
            >
              <option value="">Все категории</option>
              <option value="english">Английский</option>
              <option value="math">Математика</option>
              <option value="programming">Программирование</option>
              <option value="business">Бизнес</option>
              <option value="languages">Языки</option>
              <option value="other">Другое</option>
            </select>
          </div>

          <div>
            <label className="label">Уровень</label>
            <select
              className="input"
              value={filters.level}
              onChange={(e) => updateFilter('level', e.target.value)}
            >
              <option value="">Любой уровень</option>
              <option value="beginner">Начинающий</option>
              <option value="intermediate">Средний</option>
              <option value="advanced">Продвинутый</option>
            </select>
          </div>

          <div>
            <label className="label">Цена</label>
            <select
              className="input"
              value={filters.price_type}
              onChange={(e) => updateFilter('price_type', e.target.value)}
            >
              <option value="">Любая цена</option>
              <option value="free">Бесплатные</option>
              <option value="paid">Платные</option>
            </select>
          </div>

          <div>
            <label className="label">Сортировка</label>
            <select
              className="input"
              value={filters.sort}
              onChange={(e) => updateFilter('sort', e.target.value)}
            >
              <option value="popular">Популярные</option>
              <option value="rating">По рейтингу</option>
              <option value="price_low">Дешевле</option>
              <option value="price_high">Дороже</option>
              <option value="newest">Новые</option>
            </select>
          </div>
        </div>
      </div>

      {/* Список курсов */}
      {loading ? (
        <Spinner />
      ) : courses.length === 0 ? (
        <div className="panel">
          <p className="muted">Курсы не найдены. Попробуйте изменить фильтры.</p>
        </div>
      ) : (
        <>
          <div className="grid-3" style={{ gap: 20 }}>
            {courses.map(course => (
              <CourseCard key={course.id} course={course} />
            ))}
          </div>

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="row" style={{ justifyContent: 'center', marginTop: 32, gap: 8 }}>
              <button
                className="btn btn-quiet"
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                disabled={pagination.page === 1}
              >
                <Icon name="back" size={16} /> Назад
              </button>
              <span className="muted" style={{ padding: '8px 16px' }}>
                Страница {pagination.page} из {pagination.pages}
              </span>
              <button
                className="btn btn-quiet"
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                disabled={pagination.page === pagination.pages}
              >
                Вперёд <Icon name="chevron-right" size={16} />
              </button>
            </div>
          )}
        </>
      )}
    </>
  );
}

function CourseCard({ course }) {
  const formatPrice = (amount, currency) => {
    if (amount === 0) return 'Бесплатно';
    const formatted = (amount / 100).toFixed(2);
    const symbol = currency === 'USD' ? '$' : currency === 'RUB' ? '₽' : currency;
    return `${symbol}${formatted}`;
  };

  return (
    <Link to={`/courses/${course.slug}`} className="course-card">
      {course.thumbnail_url && (
        <div
          className="course-card-thumb"
          style={{ backgroundImage: `url(${course.thumbnail_url})` }}
        />
      )}
      <div className="course-card-body">
        <h3 className="course-card-title">{course.title}</h3>
        <p className="course-card-author small muted">
          <Icon name="user" size={14} /> {course.author_name}
        </p>

        {course.description && (
          <p className="course-card-desc small">{course.description.substring(0, 120)}...</p>
        )}

        <div className="course-card-meta">
          <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
            {course.level && <span className="badge">{course.level}</span>}
            {course.total_lessons > 0 && (
              <span className="small muted">{course.total_lessons} уроков</span>
            )}
            {course.rating > 0 && (
              <span className="small">
                ⭐ {course.rating.toFixed(1)} ({course.reviews_count})
              </span>
            )}
          </div>
        </div>

        <div className="course-card-footer">
          <div className="course-card-price">
            {formatPrice(course.price_amount, course.currency)}
          </div>
          {course.is_purchased ? (
            <span className="badge" style={{ background: 'var(--ok-soft)', color: 'var(--ok)' }}>
              ✓ Куплен
            </span>
          ) : (
            <button className="btn btn-sm">
              Подробнее <Icon name="chevron-right" size={14} />
            </button>
          )}
        </div>
      </div>
    </Link>
  );
}
