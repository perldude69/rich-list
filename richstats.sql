/*M!999999\- enable the sandbox mode */ 
-- MariaDB dump 10.19  Distrib 10.11.13-MariaDB, for debian-linux-gnu (x86_64)
--
-- Host: localhost    Database: richstats
-- ------------------------------------------------------
-- Server version	10.11.13-MariaDB-0ubuntu0.24.04.1

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `stats`
--

DROP TABLE IF EXISTS `stats`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `stats` (
  `ind` int(11) NOT NULL AUTO_INCREMENT,
  `ledgerindex` int(11) DEFAULT NULL,
  `ledgerdate` timestamp NULL DEFAULT NULL,
  `totalxrp` decimal(18,6) DEFAULT NULL,
  `walletxrp` decimal(18,6) DEFAULT NULL,
  `escrowxrp` decimal(18,6) DEFAULT NULL,
  `numaccounts` int(11) DEFAULT NULL,
  `latest` tinyint(1) DEFAULT NULL,
  PRIMARY KEY (`ind`)
) ENGINE=InnoDB AUTO_INCREMENT=413 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `top10percentages`
--

DROP TABLE IF EXISTS `top10percentages`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `top10percentages` (
  `ind` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `topacts1` int(10) unsigned DEFAULT NULL,
  `topacts2` int(10) unsigned DEFAULT NULL,
  `topacts3` int(10) unsigned DEFAULT NULL,
  `topacts4` int(10) unsigned DEFAULT NULL,
  `topacts5` int(10) unsigned DEFAULT NULL,
  `topacts6` int(10) unsigned DEFAULT NULL,
  `topacts7` int(10) unsigned DEFAULT NULL,
  `topacts8` int(10) unsigned DEFAULT NULL,
  `topacts9` int(10) unsigned DEFAULT NULL,
  `topacts10` int(10) unsigned DEFAULT NULL,
  `topbal1` decimal(18,6) DEFAULT NULL,
  `topbal2` decimal(18,6) DEFAULT NULL,
  `topbal3` decimal(18,6) DEFAULT NULL,
  `topbal4` decimal(18,6) DEFAULT NULL,
  `topbal5` decimal(18,6) DEFAULT NULL,
  `topbal6` decimal(18,6) DEFAULT NULL,
  `topbal7` decimal(18,6) DEFAULT NULL,
  `topbal8` decimal(18,6) DEFAULT NULL,
  `topbal9` decimal(18,6) DEFAULT NULL,
  `topbal10` decimal(18,6) DEFAULT NULL,
  `ledgerindex` int(11) DEFAULT NULL,
  `ledgerdate` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`ind`),
  UNIQUE KEY `ind_UNIQUE` (`ind`)
) ENGINE=InnoDB AUTO_INCREMENT=407 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `top18accountstats`
--

DROP TABLE IF EXISTS `top18accountstats`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `top18accountstats` (
  `top1` decimal(18,6) DEFAULT NULL,
  `top2` decimal(18,6) DEFAULT NULL,
  `top3` decimal(18,6) DEFAULT NULL,
  `top4` decimal(18,6) DEFAULT NULL,
  `top5` decimal(18,6) DEFAULT NULL,
  `top6` decimal(18,6) DEFAULT NULL,
  `top7` decimal(18,6) DEFAULT NULL,
  `top8` decimal(18,6) DEFAULT NULL,
  `top9` decimal(18,6) DEFAULT NULL,
  `top10` decimal(18,6) DEFAULT NULL,
  `top11` decimal(18,6) DEFAULT NULL,
  `top12` decimal(18,6) DEFAULT NULL,
  `top13` decimal(18,6) DEFAULT NULL,
  `top14` decimal(18,6) DEFAULT NULL,
  `top15` decimal(18,6) DEFAULT NULL,
  `top16` decimal(18,6) DEFAULT NULL,
  `top17` decimal(18,6) DEFAULT NULL,
  `top18` decimal(18,6) DEFAULT NULL,
  `top1ct` int(11) DEFAULT NULL,
  `top2ct` int(11) DEFAULT NULL,
  `top3ct` int(11) DEFAULT NULL,
  `top4ct` int(11) DEFAULT NULL,
  `top5ct` int(11) DEFAULT NULL,
  `top6ct` int(11) DEFAULT NULL,
  `top7ct` int(11) DEFAULT NULL,
  `top8ct` int(11) DEFAULT NULL,
  `top9ct` int(11) DEFAULT NULL,
  `top10ct` int(11) DEFAULT NULL,
  `top11ct` int(11) DEFAULT NULL,
  `top12ct` int(11) DEFAULT NULL,
  `top13ct` int(11) DEFAULT NULL,
  `top14ct` int(11) DEFAULT NULL,
  `top15ct` int(11) DEFAULT NULL,
  `top16ct` int(11) DEFAULT NULL,
  `top17ct` int(11) DEFAULT NULL,
  `top18ct` int(11) DEFAULT NULL,
  `ledgerindex` int(11) DEFAULT NULL,
  `ledgerdate` timestamp NULL DEFAULT NULL,
  `ind` int(10) unsigned NOT NULL AUTO_INCREMENT,
  PRIMARY KEY (`ind`),
  UNIQUE KEY `ind_UNIQUE` (`ind`)
) ENGINE=InnoDB AUTO_INCREMENT=407 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='Top 18 sums';
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;
