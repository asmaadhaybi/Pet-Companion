<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Pet Analytics Report</title>
    <style>
        body { font-family: DejaVu Sans, sans-serif; margin: 20px; color: #333; line-height: 1.6; }
        h1, h2 { color: #257D8C; border-bottom: 2px solid #257D8C; padding-bottom: 5px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; font-weight: bold; }
        .pet-info { margin-bottom: 20px; padding: 15px; background-color: #f9f9f9; border-left: 4px solid #257D8C; }
        .summary-section { margin-bottom: 25px; }
        .metric-row { margin-bottom: 5px; }
        .generated-info { font-size: 12px; color: #666; text-align: right; margin-top: 30px; }
    </style>
</head>
<body>
    @php
        $pet = $data['report_info']['pet'];
        $nutrition = $data['nutrition_summary'];
        $activity = $data['activity_summary'];
        $health = $data['health_summary'] ?? [];
        $reportInfo = $data['report_info'];
    @endphp

    <h1>Analytics Report for {{ $pet['name'] }}</h1>
    
    <div class="pet-info">
        <h2>Pet Information</h2>
        <div class="metric-row"><strong>Name:</strong> {{ $pet['name'] }}</div>
        <div class="metric-row"><strong>Type:</strong> {{ ucfirst($pet['type']) }}</div>
        <div class="metric-row"><strong>Breed:</strong> {{ $pet['breed'] }}</div>
        <div class="metric-row"><strong>Age:</strong> {{ $pet['age'] }} years</div>
        <div class="metric-row"><strong>Weight:</strong> {{ $pet['weight'] }} kg</div>
    </div>

    <div class="summary-section">
        <h2>Nutrition Summary</h2>
        <table>
            <thead>
                <tr>
                    <th>Metric</th>
                    <th>Total</th>
                    <th>Daily Average</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>Water Intake</td>
                    <td>{{ number_format($nutrition['water_intake'] ?? 0) }} ml</td>
                    <td>{{ number_format($nutrition['daily_average']['water'] ?? 0) }} ml/day</td>
                </tr>
                <tr>
                    <td>Food Intake</td>
                    <td>{{ number_format($nutrition['food_intake'] ?? 0) }} g</td>
                    <td>{{ number_format($nutrition['daily_average']['food'] ?? 0) }} g/day</td>
                </tr>
                <tr>
                    <td>Treats Given</td>
                    <td>{{ number_format($nutrition['treats_given'] ?? 0) }} g</td>
                    <td>{{ number_format($nutrition['daily_average']['treats'] ?? 0) }} g/day</td>
                </tr>
                @if(isset($nutrition['medication_taken']))
                <tr>
                    <td>Medication</td>
                    <td>{{ number_format($nutrition['medication_taken'] ?? 0) }} doses</td>
                    <td>{{ number_format($nutrition['daily_average']['meds'] ?? 0) }} doses/day</td>
                </tr>
                @endif
            </tbody>
        </table>
    </div>

    <div class="summary-section">
        <h2>Activity Summary</h2>
        <table>
            <thead>
                <tr>
                    <th>Metric</th>
                    <th>Value</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>Games Played</td>
                    <td>{{ $activity['games_played'] ?? 0 }}</td>
                </tr>
                <tr>
                    <td>Total Play Time</td>
                    <td>{{ number_format($activity['total_play_time'] ?? 0, 1) }} minutes</td>
                </tr>
                <tr>
                    <td>Points Earned</td>
                    <td>{{ number_format($activity['points_earned'] ?? 0) }}</td>
                </tr>
                <tr>
                    <td>Average Score</td>
                    <td>{{ number_format($activity['average_score'] ?? 0, 1) }}</td>
                </tr>
                <tr>
                    <td>Favorite Game</td>
                    <td>{{ $activity['favorite_game'] ?? 'None' }}</td>
                </tr>
                <tr>
                    <td>Total Sessions</td>
                    <td>{{ $activity['total_sessions'] ?? 0 }}</td>
                </tr>
                <tr>
                    <td>Average Session Duration</td>
                    <td>{{ number_format($activity['avg_session_duration'] ?? 0, 1) }} minutes</td>
                </tr>
            </tbody>
        </table>
    </div>

    @if(!empty($health))
    <div class="summary-section">
        <h2>Health Summary</h2>
        <table>
            <thead>
                <tr>
                    <th>Metric</th>
                    <th>Value</th>
                </tr>
            </thead>
            <tbody>
                @if(isset($health['mood_score']))
                <tr>
                    <td>Mood Score</td>
                    <td>{{ $health['mood_score'] }}/100</td>
                </tr>
                @endif
                @if(isset($health['activity_level']))
                <tr>
                    <td>Activity Level</td>
                    <td>{{ $health['activity_level'] }}</td>
                </tr>
                @endif
                @if(isset($health['weight_trend']))
                <tr>
                    <td>Weight Trend</td>
                    <td>{{ ucfirst($health['weight_trend']) }}</td>
                </tr>
                @endif
                @if(isset($health['sleep_quality']))
                <tr>
                    <td>Sleep Quality</td>
                    <td>{{ $health['sleep_quality'] }}/100</td>
                </tr>
                @endif
            </tbody>
        </table>
    </div>
    @endif

    <div class="generated-info">
        <p>Report generated on {{ \Carbon\Carbon::parse($reportInfo['generated_at'])->format('F j, Y \a\t g:i A') }}</p>
        <p>Report Type: {{ ucfirst($reportInfo['type']) }} ({{ ucfirst($reportInfo['period']) }})</p>
        <p>This report covers {{ $nutrition['period_days'] ?? 7 }} days of data</p>
    </div>

</body>
</html>