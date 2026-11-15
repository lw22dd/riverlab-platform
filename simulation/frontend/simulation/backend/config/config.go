package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"

	"github.com/spf13/viper"
	"gopkg.in/yaml.v3"
)

var Conf = &Config{}

type Config struct {
	App      AppConfig      `mapstructure:"app" yaml:"app"`
	Server   ServerConfig   `mapstructure:"server" yaml:"server"`
	Logger   LoggerConfig   `mapstructure:"logger" yaml:"logger"`
	Database DatabaseConfig `mapstructure:"database" yaml:"database"`
	Redis    RedisConfig    `mapstructure:"redis" yaml:"redis"`
	JWT      JWTConfig      `mapstructure:"jwt" yaml:"jwt"`
	MinIO    MinIOConfig    `mapstructure:"minio" yaml:"minio"`
	NoAuth   []string       `mapstructure:"no_auth" yaml:"no_auth"`
	Proxy    ProxyConfig    `mapstructure:"proxy" yaml:"proxy"`
}

func Init() error {
	viper.SetDefault("app.debug", true)
	viper.SetDefault("server.port", 7000)
	viper.SetDefault("server.mode", "debug")
	viper.SetDefault("jwt.access_timeout", 60)
	viper.SetDefault("jwt.refresh_timeout", 168)
	viper.SetDefault("jwt.issuer", "webGL-720yun")

	if err := loadFromConfigFile(); err != nil {
		if err := initViperConfig(); err != nil {
			return fmt.Errorf("加载配置文件失败: %v", err)
		}

		if err := viper.Unmarshal(Conf); err != nil {
			return fmt.Errorf("解析viper配置失败: %v", err)
		}
	}

	if err := loadFromEnv(); err != nil {
		return err
	}

	return nil
}

func initViperConfig() error {
	viper.SetConfigName("config.dev")
	viper.SetConfigType("yaml")

	viper.AddConfigPath("./config")
	viper.AddConfigPath(".")
	viper.AddConfigPath("../config")
	viper.AddConfigPath("..")
	viper.AddConfigPath("../../config")
	viper.AddConfigPath("../..")

	viper.SetDefault("server.port", 7000)
	viper.SetDefault("server.mode", "debug")
	viper.SetDefault("jwt.access_timeout", 60)
	viper.SetDefault("jwt.refresh_timeout", 168)
	viper.SetDefault("jwt.issuer", "webGL-720yun")

	if err := viper.ReadInConfig(); err != nil {
		return fmt.Errorf("读取配置文件失败: %v", err)
	}

	return nil
}

func loadFromEnv() error {
	envBool("APP_DEBUG", &Conf.App.Debug)
	envBool("APP_INIT_DATA", &Conf.App.InitData)
	envString("APP_ENV", &Conf.App.Environment)
	envString("APP_SEED_BASE_PATH", &Conf.App.SeedBasePath)
	envInt("SERVER_PORT", &Conf.Server.Port)

	envString("DB_HOST", &Conf.Database.Host)
	envInt("DB_PORT", &Conf.Database.Port)
	envString("DB_USER", &Conf.Database.Username)
	envString("DB_PASSWORD", &Conf.Database.Password)
	envString("DB_NAME", &Conf.Database.Database)

	envString("REDIS_HOST", &Conf.Redis.Host)
	envInt("REDIS_PORT", &Conf.Redis.Port)
	envString("REDIS_PASSWORD", &Conf.Redis.Password)
	envInt("REDIS_DB", &Conf.Redis.DB)

	envString("MINIO_ENDPOINT", &Conf.MinIO.Endpoint)
	envString("MINIO_ACCESS_KEY", &Conf.MinIO.AccessKey)
	envString("MINIO_SECRET_KEY", &Conf.MinIO.SecretKey)
	envString("MINIO_BUCKET", &Conf.MinIO.Bucket)
	envBool("MINIO_USE_SSL", &Conf.MinIO.UseSSL)

	envString("JWT_SECRET", &Conf.JWT.Secret)
	envInt("JWT_ACCESS_TIMEOUT", &Conf.JWT.AccessTimeout)
	envInt("JWT_REFRESH_TIMEOUT", &Conf.JWT.RefreshTimeout)
	envString("JWT_ISSUER", &Conf.JWT.Issuer)
	return nil
}

func envString(key string, target *string) {
	if value := strings.TrimSpace(os.Getenv(key)); value != "" {
		*target = value
	}
}

func envInt(key string, target *int) {
	if value := strings.TrimSpace(os.Getenv(key)); value != "" {
		if parsed, err := strconv.Atoi(value); err == nil {
			*target = parsed
		}
	}
}

func envBool(key string, target *bool) {
	if value := strings.TrimSpace(os.Getenv(key)); value != "" {
		if parsed, err := strconv.ParseBool(value); err == nil {
			*target = parsed
		}
	}
}

func loadFromConfigFile() error {
	filename := strings.TrimSpace(os.Getenv("CONFIG_FILE"))
	if filename == "" {
		currentDir, err := os.Getwd()
		if err != nil {
			return fmt.Errorf("获取当前目录失败: %v", err)
		}

		if os.Getenv("APP_ENV") == "production" {
			filename = currentDir + "/config/config.prod.yaml"
		} else {
			filename = currentDir + "/config/config.dev.yaml"
		}

		if _, err := os.Stat(filename); os.IsNotExist(err) {
			filename = currentDir + "/config.dev.yaml"
			if _, err := os.Stat(filename); os.IsNotExist(err) {
				return fmt.Errorf("配置文件不存在: %s", filename)
			}
		}
	}

	data, err := os.ReadFile(filename)
	if err != nil {
		return fmt.Errorf("读取配置文件失败: %v", err)
	}

	if err := yaml.Unmarshal(data, Conf); err != nil {
		return fmt.Errorf("解析配置文件失败: %v", err)
	}

	return nil
}

func GetViper() *viper.Viper {
	return viper.GetViper()
}
