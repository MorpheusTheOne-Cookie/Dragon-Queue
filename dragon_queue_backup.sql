-- MySQL dump 10.13  Distrib 8.0.45, for Win64 (x86_64)
--
-- Host: localhost    Database: dragon_queue
-- ------------------------------------------------------
-- Server version	8.0.45

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `matches`
--

LOCK TABLES `matches` WRITE;
/*!40000 ALTER TABLE `matches` DISABLE KEYS */;
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
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
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
  `status` enum('waiting','playing') NOT NULL DEFAULT 'waiting',
  `joined_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `one_place_per_station` (`station_id`,`user_id`),
  KEY `queue_order` (`station_id`,`status`,`joined_at`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `queue_entries_ibfk_1` FOREIGN KEY (`station_id`) REFERENCES `stations` (`id`) ON DELETE CASCADE,
  CONSTRAINT `queue_entries_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `queue_entries`
--

LOCK TABLES `queue_entries` WRITE;
/*!40000 ALTER TABLE `queue_entries` DISABLE KEYS */;
INSERT INTO `queue_entries` VALUES (1,1,1,'waiting','2026-09-11 08:12:29');
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
) ENGINE=InnoDB AUTO_INCREMENT=55 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `rules`
--

LOCK TABLES `rules` WRITE;
/*!40000 ALTER TABLE `rules` DISABLE KEYS */;
INSERT INTO `rules` VALUES (1,'house-respect','House Rules','Respect other players and the equipment at all times.',1,1),(2,'house-one-game','House Rules','One game per turn while other people are waiting.',1,2),(3,'house-missed-turn','House Rules','Miss your turn and you go to the back of the queue.',1,3),(4,'house-multiple-queues','House Rules','You may queue for both tables at the same time.',1,4),(5,'house-hello','House Rules','Hellow.',1,5),(6,'pool-winner-stays','Pool Table Rules','Winner stays on for a maximum of two games.',2,1),(7,'pool-return-equipment','Pool Table Rules','Return all cues and balls when your game ends.',2,2),(8,'tennis-scoring','Table Tennis Rules','Games are first to 11 points, win by two.',3,1),(9,'tennis-return-equipment','Table Tennis Rules','Return the paddles and balls when your game ends.',3,2);
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
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
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
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `username` varchar(50) NOT NULL,
  `email` varchar(150) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `title` varchar(50) NOT NULL DEFAULT 'Student',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES (1,'TESTER','tester@gmail.com','3a58be987bef5dcd0947c3df144d5b9b:2a4d5a4cd4ed9b445d6040c15a63d3d261377d7dbecbfc8c33584bd0392a7edebb1d9bf328eca406f32e4bd666e7d5fd2c37ba22fd2dd0545d091b9238dc98f3','Student','2026-09-11 08:12:28');
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

-- Dump completed on 2026-09-13 16:38:40
