<?php if (!defined('STATS_ENTRY')) { http_response_code(403); exit; } ?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>DevEx Compass Stats · Sign in</title>
<link rel="icon" type="image/png" href="../assets/favicon.png">
<link rel="stylesheet" href="assets/stats.css">
</head>
<body class="login-page">
<form class="login" method="post" action="">
    <h1><img src="../assets/favicon.png" alt="" width="22" height="22"> DevEx Compass <span>Stats</span></h1>
    <p class="sub">Usage and feedback for the DevEx Metrics Compass.</p>

    <label for="password">Password</label>
    <input type="password" id="password" name="password" autocomplete="current-password" autofocus required>

    <?php if ($loginError !== ''): ?>
        <p class="error"><?= e($loginError) ?></p>
    <?php endif; ?>

    <button type="submit">Sign in</button>
</form>
</body>
</html>
