-- MySQL dump 10.13  Distrib 8.0.45, for Win64 (x86_64)
--
-- Host: 127.0.0.1    Database: railway
-- ------------------------------------------------------
-- Server version	9.4.0

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `active_games`
--

DROP TABLE IF EXISTS `active_games`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `active_games` (
  `station_id` int NOT NULL,
  `player_a_id` int NOT NULL,
  `player_b_id` int DEFAULT NULL,
  `status` enum('waiting_for_opponent','confirming','playing') NOT NULL DEFAULT 'confirming',
  `player_a_confirmed` tinyint(1) NOT NULL DEFAULT '0',
  `player_b_confirmed` tinyint(1) NOT NULL DEFAULT '0',
  `player_a_result` enum('win','loss') DEFAULT NULL,
  `player_b_result` enum('win','loss') DEFAULT NULL,
  `confirmation_deadline` datetime DEFAULT NULL,
  `started_at` datetime DEFAULT NULL,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`station_id`),
  KEY `player_a_id` (`player_a_id`),
  KEY `player_b_id` (`player_b_id`),
  CONSTRAINT `active_games_ibfk_1` FOREIGN KEY (`station_id`) REFERENCES `stations` (`id`) ON DELETE CASCADE,
  CONSTRAINT `active_games_ibfk_2` FOREIGN KEY (`player_a_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `active_games_ibfk_3` FOREIGN KEY (`player_b_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `active_games`
--

LOCK TABLES `active_games` WRITE;
/*!40000 ALTER TABLE `active_games` DISABLE KEYS */;
/*!40000 ALTER TABLE `active_games` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `matches`
--

DROP TABLE IF EXISTS `matches`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `matches` (
  `id` int NOT NULL AUTO_INCREMENT,
  `station_id` int NOT NULL,
  `winner_id` int NOT NULL,
  `loser_id` int NOT NULL,
  `played_on` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `winner_lookup` (`winner_id`),
  KEY `loser_lookup` (`loser_id`),
  KEY `station_id` (`station_id`),
  CONSTRAINT `matches_ibfk_1` FOREIGN KEY (`station_id`) REFERENCES `stations` (`id`) ON DELETE CASCADE,
  CONSTRAINT `matches_ibfk_2` FOREIGN KEY (`winner_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `matches_ibfk_3` FOREIGN KEY (`loser_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `matches`
--

LOCK TABLES `matches` WRITE;
/*!40000 ALTER TABLE `matches` DISABLE KEYS */;
INSERT INTO `matches` VALUES (1,2,1,2,'2026-09-18 08:51:27'),(2,2,1,2,'2026-09-18 08:53:07'),(3,1,1,2,'2026-09-18 08:53:33');
/*!40000 ALTER TABLE `matches` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `news`
--

DROP TABLE IF EXISTS `news`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `news` (
  `id` int NOT NULL AUTO_INCREMENT,
  `title` varchar(200) NOT NULL,
  `event_date` date NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `one_news_item` (`title`,`event_date`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `news`
--

LOCK TABLES `news` WRITE;
/*!40000 ALTER TABLE `news` DISABLE KEYS */;
INSERT INTO `news` VALUES (2,'Singles pool tournament sign-ups open this Friday.','2026-09-20'),(3,'Table Tennis tournament sign-ups open this Friday.','2026-10-14'),(1,'Welcome to Dragon Queue! Join a table from the dashboard.','2026-09-11');
/*!40000 ALTER TABLE `news` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `queue_entries`
--

DROP TABLE IF EXISTS `queue_entries`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `queue_entries` (
  `id` int NOT NULL AUTO_INCREMENT,
  `station_id` int NOT NULL,
  `user_id` int NOT NULL,
  `status` enum('waiting','called','playing','postgame') NOT NULL DEFAULT 'waiting',
  `joined_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `one_place_per_station` (`station_id`,`user_id`),
  KEY `queue_order` (`station_id`,`status`,`joined_at`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `queue_entries_ibfk_1` FOREIGN KEY (`station_id`) REFERENCES `stations` (`id`) ON DELETE CASCADE,
  CONSTRAINT `queue_entries_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `queue_entries`
--

LOCK TABLES `queue_entries` WRITE;
/*!40000 ALTER TABLE `queue_entries` DISABLE KEYS */;
/*!40000 ALTER TABLE `queue_entries` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `rules`
--

DROP TABLE IF EXISTS `rules`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `rules` (
  `id` int NOT NULL AUTO_INCREMENT,
  `rule_key` varchar(80) NOT NULL,
  `section` varchar(80) NOT NULL,
  `body` varchar(255) NOT NULL,
  `section_order` int NOT NULL DEFAULT '0',
  `rule_order` int NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `rule_key` (`rule_key`)
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `rules`
--

LOCK TABLES `rules` WRITE;
/*!40000 ALTER TABLE `rules` DISABLE KEYS */;
INSERT INTO `rules` VALUES (1,'house-respect','House Rules','Respect other players and the equipment at all times.',1,1),(2,'house-one-game','House Rules','One game per turn while other people are waiting.',1,2),(3,'house-missed-turn','House Rules','Miss your turn and you go to the back of the queue.',1,3),(4,'house-multiple-queues','House Rules','You may queue for both tables at the same time.',1,4),(5,'Equipment-care','House Rules','Please do not break the Pool Cues, Table Tennis paddles, or any other equipment. pls',1,5),(6,'pool-winner-stays','Pool Table Rules','Winner stays on for as long as they keep winning, loser goes to the back of the queue.',2,1),(7,'8-ball-break','Pool Table Rules','If u get the 8 ball in off break then you win right away',2,2),(8,'pool-return-equipment','Pool Table Rules','Return all cues and balls when your game ends.',2,2),(9,'tennis-scoring','Table Tennis Rules','Games are first to 11 points, win by two. cap at 15 points. or first to 21 points cap at 25.',3,1),(10,'tennis-return-equipment','Table Tennis Rules','Return the paddles and balls when your game ends.',3,2),(11,'8-ball-pocket','Bethune Pool Table Rules','Anytime during the game if the 8 ball enters the wrong hole it doesnt mean u lose, it is ball in hand for the other person, and the 8 ball is placed on the dot (sticker) where the triangle was initially',4,1),(12,'8-ball-bank','Bethune Pool Table Rules','When all you balls are pocketed and you are on the 8 ball, you perform 3 banks (hitting the 8 ball or cue ball of a wall) which range for 3 of your turns before u can take the ball straight into the pocket.',4,2);
/*!40000 ALTER TABLE `rules` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `stations`
--

DROP TABLE IF EXISTS `stations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `stations` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(50) NOT NULL,
  `slug` varchar(50) NOT NULL,
  `avg_game_minutes` int NOT NULL DEFAULT '10',
  `current_players` varchar(120) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `slug` (`slug`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `stations`
--

LOCK TABLES `stations` WRITE;
/*!40000 ALTER TABLE `stations` DISABLE KEYS */;
INSERT INTO `stations` VALUES (1,'Pool Table','pool',15,NULL),(2,'Table Tennis','table-tennis',10,NULL);
/*!40000 ALTER TABLE `stations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `user_sessions`
--

DROP TABLE IF EXISTS `user_sessions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_sessions` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `token_hash` char(64) NOT NULL,
  `user_id` int NOT NULL,
  `expires_at` datetime NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `token_hash` (`token_hash`),
  KEY `session_expiry` (`expires_at`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `user_sessions_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user_sessions`
--

LOCK TABLES `user_sessions` WRITE;
/*!40000 ALTER TABLE `user_sessions` DISABLE KEYS */;
INSERT INTO `user_sessions` VALUES (1,'b80909439d2fccf94027c017208a3da747bdb3cdfa8003916eba47636ab40853',1,'2026-09-25 08:41:07','2026-09-18 08:41:07'),(2,'9af6864f6d94bee6889a80b8ad96ca681c78eb1da2f2ea4948025bc647cd756e',2,'2026-09-25 08:44:25','2026-09-18 08:44:25'),(3,'d3ac24a994f3caa3d182f881b93591cf59064bcc4ab3de8b057c9c1e9ce42505',1,'2026-09-25 08:50:28','2026-09-18 08:50:28');
/*!40000 ALTER TABLE `user_sessions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `username` varchar(50) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `title` enum('student','temp_admin','main_admin') NOT NULL DEFAULT 'student',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES (1,'MorpheusTheOne','06d515d773ac2d99dd521525dc5a2776:e79e6c399fb7c76a83cb6369c5fd278e1264916083b238c5ec75f3403acbb118af711af8357433251677936e1ff2f56bf7865b67852606dd28db0f7f4b4460a3','main_admin','2026-09-18 08:41:07'),(2,'Dragons','72057cb54c50f7643c04e529354912ed:43f576c67da9cb7a0a76b6c50203ecfd5ee249f7e84ed2fb1587e40251b783d56390a80a98b8899a806d9f3f63e95fc2687b659ba345eb527d66255296238daa','temp_admin','2026-09-18 08:44:25');
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-09-18  5:13:53
