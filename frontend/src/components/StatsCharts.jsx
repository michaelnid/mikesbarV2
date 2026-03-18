import { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend
);

const REFRESH_INTERVAL = 30000; // 30 Sekunden für Chart-Updates

export default function StatsCharts({ token, onRefresh }) {
    const [chartData, setChartData] = useState(null);
    const [loading, setLoading] = useState(true);
    const intervalRef = useRef(null);

    useEffect(() => {
        loadChartData();
    }, [onRefresh]);

    // Automatisches Polling für Live-Updates
    useEffect(() => {
        intervalRef.current = setInterval(loadChartData, REFRESH_INTERVAL);
        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, [token]);

    const loadChartData = async () => {
        try {
            const data = await api.getChartData(token, 7);
            setChartData(data);
        } catch (err) {
            console.error('Failed to load chart data:', err);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return <div className="h-64 bg-neutral-800 rounded-xl animate-pulse"></div>;
    }

    if (!chartData || chartData.length === 0) {
        return <div className="p-6 bg-neutral-800 rounded-xl text-neutral-500 text-center">
            Keine Daten verfügbar
        </div>;
    }

    const data = {
        labels: chartData.map(d => d.date),
        datasets: [
            {
                label: 'Einzahlungen',
                data: chartData.map(d => d.deposits),
                backgroundColor: 'rgba(16, 185, 129, 0.8)',
                borderRadius: 4,
            },
            {
                label: 'Auszahlungen',
                data: chartData.map(d => d.withdrawals),
                backgroundColor: 'rgba(239, 68, 68, 0.8)',
                borderRadius: 4,
            }
        ],
    };

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'top',
                labels: { color: '#a3a3a3' }
            },
            title: {
                display: true,
                text: 'Einzahlungen vs. Auszahlungen (letzte 7 Tage)',
                color: '#fff',
                font: { size: 14 }
            },
        },
        scales: {
            x: {
                ticks: { color: '#a3a3a3' },
                grid: { color: 'rgba(255,255,255,0.1)' }
            },
            y: {
                ticks: { color: '#a3a3a3' },
                grid: { color: 'rgba(255,255,255,0.1)' }
            }
        }
    };

    return (
        <div className="p-4 bg-neutral-800 rounded-xl border border-neutral-700" style={{ height: '320px' }}>
            <Bar data={data} options={options} />
        </div>
    );
}
